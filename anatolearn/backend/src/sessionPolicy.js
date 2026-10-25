// How long a signed-in session may sit unused before it stops working. The 24 hour absolute limit (auth_sessions.expires_at)
// still applies on top. Read per call so the policy can change without a restart in tests.
const STAFF_ROLES = ['teacher', 'admin'];
const DEFAULTS = { staff: 120, student: 480 };   // minutes
const BOUNDS = { min: 5, max: 24 * 60 };

function minutes(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= BOUNDS.min && parsed <= BOUNDS.max ? parsed : fallback;
}
const idleMinutes = (role, env = process.env) => STAFF_ROLES.includes(role)
  ? minutes(env.SESSION_IDLE_MINUTES_STAFF, DEFAULTS.staff)
  : minutes(env.SESSION_IDLE_MINUTES_STUDENT, DEFAULTS.student);

module.exports = { idleMinutes, STAFF_ROLES, DEFAULTS };
