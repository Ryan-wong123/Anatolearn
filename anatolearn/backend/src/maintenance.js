const ACTIVE_QUIZ_SESSION = `submitted_at IS NULL AND session_expires_at > NOW()
  AND (expires_at IS NULL OR expires_at + INTERVAL '10 seconds' > NOW())`;

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

const SESSION_LIFETIME_HOURS = positiveInteger(process.env.QUIZ_SESSION_LIFETIME_HOURS, 24, 168);
const SESSION_RETENTION_DAYS = positiveInteger(process.env.SESSION_RETENTION_DAYS, 30, 365);

async function cleanupSessions(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query('SELECT pg_try_advisory_xact_lock(71212, 1) AS acquired');
    if (!lock.rows[0].acquired) { await client.query('ROLLBACK'); return { skipped: true }; }
    const expired = await client.query(`UPDATE quiz_sessions SET submitted_at = NOW()
      WHERE submitted_at IS NULL AND (session_expires_at <= NOW()
        OR expires_at + INTERVAL '10 seconds' <= NOW())`);
    const quizzes = await client.query(`DELETE FROM quiz_sessions
      WHERE submitted_at < NOW() - $1 * INTERVAL '1 day'`, [SESSION_RETENTION_DAYS]);
    const auth = await client.query(`DELETE FROM auth_sessions
      WHERE COALESCE(revoked_at, expires_at) < NOW() - $1 * INTERVAL '1 day'`, [SESSION_RETENTION_DAYS]);
    await client.query('COMMIT');
    return { expired: expired.rowCount, removedQuizSessions: quizzes.rowCount, removedAuthSessions: auth.rowCount };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

function startMaintenance(pool) {
  const run = () => cleanupSessions(pool).catch((error) => console.error('Session maintenance failed:', error.message));
  void run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}

if (require.main === module) {
  const pool = require('./db');
  cleanupSessions(pool).then(console.log).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
}
module.exports = { ACTIVE_QUIZ_SESSION, SESSION_LIFETIME_HOURS, cleanupSessions, startMaintenance };
