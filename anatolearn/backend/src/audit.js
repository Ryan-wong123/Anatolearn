const pool = require('./db');

// Audit actions that should also reach the log stream, so CloudWatch metric filters and alarms can watch them
// (ops/cloudwatch/setup-alarms.sh). Lines carry ids and IPs only, never names or email addresses.
const SECURITY_ACTIONS = new Set(['auth.login_failed', 'auth.account_locked', 'auth.login_blocked_locked', 'auth.login_blocked_disabled',
  'auth.mfa_failed', 'auth.password_check_failed', 'auth.password_check_blocked_locked', 'auth.mfa_recovery_used', 'user.reset_mfa', 'user.reset_password', 'profile.mfa_disabled',
  'profile.mfa_recovery_regenerated', 'profile.signout_everywhere']);

// Returns the structured log entry for a security-relevant audit action, or null when it should not be logged.
function securityEvent({ actor, action, targetId = null, detail = {}, ip = null }, now = new Date()) {
  if (!SECURITY_ACTIONS.has(action)) return null;
  return { time: now.toISOString(), level: 'warn', msg: 'security_event', action, actor: actor?.id ?? null,
    target: targetId == null ? null : String(targetId), ip, ...(Number.isInteger(detail?.attempts) ? { attempts: detail.attempts } : {}) };
}
const securityLogEnabled = () => process.env.LOG_SECURITY_EVENTS === 'true' || (process.env.NODE_ENV === 'production' && process.env.LOG_SECURITY_EVENTS !== 'false');

// Best-effort: an audit write must never fail the request it describes.
async function record({ actor, action, targetType = null, targetId = null, detail = {}, ip = null }) {
  // Logged before the database write, so an alert still fires if the database is the thing that is failing.
  const event = securityLogEnabled() ? securityEvent({ actor, action, targetId, detail, ip }) : null;
  if (event) console.log(JSON.stringify(event));
  try {
    await pool.query(`INSERT INTO audit_log(actor_id, actor_name, action, target_type, target_id, detail, ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actor?.id ?? null, actor?.name ?? null, action, targetType, targetId == null ? null : String(targetId), JSON.stringify(detail), ip]);
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

// Logs every successful state-changing API call by a signed-in user (who, what, which record) without bodies.
function auditMutations(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || process.env.AUDIT_MUTATIONS === 'false') return next();
  res.once('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const pathName = req.originalUrl.split('?')[0].replace(/^\/api/, '');
    const target = /^\/([a-z-]+)\/(\d+)/.exec(pathName);
    void record({ actor: req.user, action: `${req.method} ${pathName.replace(/\/\d+/g, '/:id')}`,
      targetType: target?.[1] ?? null, targetId: target?.[2] ?? null, ip: req.ip });
  });
  next();
}
module.exports = { record, auditMutations, securityEvent, SECURITY_ACTIONS };
