const pool = require('../../db');
const USER_COLUMNS = `id, name, email, role, program_id, is_active, last_login_at, created_at,
  (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked, (mfa_enabled_at IS NOT NULL) AS mfa_enabled`;
async function listUsers({ q, role, status }) {
    const conditions = [], parameters = [];
    if (q) { parameters.push(`%${q}%`); conditions.push(`(name ILIKE $${parameters.length} OR email ILIKE $${parameters.length})`); }
    if (role) { parameters.push(role); conditions.push(`role = $${parameters.length}`); }
    if (status === 'active') conditions.push('is_active');
    if (status === 'disabled') conditions.push('NOT is_active');
    if (status === 'locked') conditions.push('locked_until > NOW()');
    return pool.query(`SELECT ${USER_COLUMNS} FROM users ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY created_at DESC, id DESC`, parameters);
}
async function findUser(parameters) { return pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, parameters); }
async function findByEmail(parameters) { return pool.query('SELECT id FROM users WHERE email = $1', parameters); }
async function insertUser(parameters) {
    return pool.query(`INSERT INTO users (name, email, password_hash, role, program_id, password_changed_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING ${USER_COLUMNS}`, parameters);
}
async function updateUser(parameters) {
    return pool.query(`UPDATE users SET name = $2, role = $3, program_id = $4, is_active = $5,
      failed_login_count = CASE WHEN $6 THEN 0 ELSE failed_login_count END,
      locked_until = CASE WHEN $6 THEN NULL ELSE locked_until END WHERE id = $1 RETURNING ${USER_COLUMNS}`, parameters);
}
async function setPassword(parameters) {
    return pool.query('UPDATE users SET password_hash = $2, password_changed_at = NOW(), failed_login_count = 0, locked_until = NULL WHERE id = $1 RETURNING id', parameters);
}
async function revokeSessions(parameters) { return pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', parameters); }
async function deleteUser(parameters) { return pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email', parameters); }
async function countOtherActiveTeachers(parameters) {
    return pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'teacher' AND is_active AND id <> $1", parameters);
}
async function countOtherActiveAdmins(parameters) {
    return pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND is_active AND id <> $1", parameters);
}
async function findProgram(parameters) { return pool.query('SELECT id FROM programs WHERE id = $1', parameters); }
async function listAuditLog({ actor, action }) {
    const conditions = [], parameters = [];
    if (actor) { parameters.push(Number(actor) || 0); conditions.push(`actor_id = $${parameters.length}`); }
    if (action) { parameters.push(`${action}%`); conditions.push(`action ILIKE $${parameters.length}`); }
    return pool.query(`SELECT id, actor_id, actor_name, action, target_type, target_id, detail, ip, created_at FROM audit_log
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY id DESC LIMIT 1000`, parameters);
}
async function resetMfa(parameters) {
    return pool.query(`UPDATE users SET mfa_secret = NULL, mfa_pending_secret = NULL, mfa_enabled_at = NULL, mfa_last_step = NULL,
      mfa_recovery_hashes = '{}' WHERE id = $1 RETURNING id`, parameters);
}
module.exports = { resetMfa, listUsers, findUser, findByEmail, insertUser, updateUser, setPassword, revokeSessions, deleteUser, countOtherActiveTeachers, countOtherActiveAdmins, findProgram, listAuditLog };
