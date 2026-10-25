const pool = require('../../db');
// parameters: [sessionId, userId, staffIdleMinutes, studentIdleMinutes]. A session idle for longer than its role allows is rejected.
async function findSessionUser(parameters) {
    return pool.query(`SELECT u.id, u.name, u.role, u.program_id, (u.mfa_enabled_at IS NOT NULL) AS mfa_enabled,
      (s.last_seen_at < NOW() - INTERVAL '1 minute') AS stale FROM auth_sessions s
      JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2
      AND s.revoked_at IS NULL AND s.expires_at > NOW() AND u.is_active
      AND s.last_seen_at > NOW() - (CASE WHEN u.role IN ('teacher', 'admin') THEN $3::int ELSE $4::int END) * INTERVAL '1 minute'`, parameters);
}
// Called at most once a minute per session, so activity does not turn into a database write per request.
async function touchSession(parameters) {
    return pool.query('UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL', parameters);
}
async function findExistingEmail(parameters) {
    return pool.query("SELECT id FROM users WHERE email = $1", parameters);
}
async function insertUser(parameters) {
    return pool.query(`INSERT INTO users (name, email, password_hash, role, program_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, program_id, created_at`, parameters);
}
async function findUserByEmail(parameters) {
    return pool.query("SELECT id, name, email, password_hash, role, program_id, is_active, locked_until, (locked_until > NOW()) AS is_locked, (mfa_enabled_at IS NOT NULL) AS mfa_enabled FROM users WHERE email = $1", parameters);
}
async function insertSession(parameters) {
    return pool.query("INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '24 hours')", parameters);
}
async function revokeSession(parameters) {
    return pool.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1 AND user_id=$2', parameters);
}
async function findProgram(parameters) {
    return pool.query('SELECT id FROM programs WHERE id = $1', parameters);
}
async function registerFailedLogin(parameters) {
    return pool.query(`UPDATE users SET failed_login_count = failed_login_count + 1,
      locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN NOW() + $3 * INTERVAL '1 minute' ELSE locked_until END
      WHERE id = $1 RETURNING failed_login_count, locked_until`, parameters);
}
async function registerSuccessfulLogin(parameters) {
    return pool.query('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1', parameters);
}
async function findUserForMfa(parameters) {
    return pool.query(`SELECT id, name, email, role, program_id, is_active, (locked_until > NOW()) AS is_locked,
      mfa_secret, mfa_last_step FROM users WHERE id = $1 AND mfa_enabled_at IS NOT NULL`, parameters);
}
// Both claims are atomic so two parallel requests cannot spend the same code twice.
async function claimTotpStep(parameters) {
    return pool.query('UPDATE users SET mfa_last_step = $2 WHERE id = $1 AND (mfa_last_step IS NULL OR mfa_last_step < $2) RETURNING id', parameters);
}
async function consumeRecoveryCode(parameters) {
    return pool.query(`UPDATE users SET mfa_recovery_hashes = array_remove(mfa_recovery_hashes, $2)
      WHERE id = $1 AND $2 = ANY(mfa_recovery_hashes) RETURNING cardinality(mfa_recovery_hashes) AS remaining`, parameters);
}
module.exports = { touchSession, findUserForMfa, claimTotpStep, consumeRecoveryCode, registerFailedLogin, registerSuccessfulLogin, findProgram, findSessionUser, findExistingEmail, insertUser, findUserByEmail, insertSession, revokeSession };
