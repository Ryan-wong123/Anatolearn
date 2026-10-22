const pool = require('../../db');
async function findSessionUser(parameters) {
    return pool.query(`SELECT u.id, u.name, u.role, u.program_id FROM auth_sessions s
      JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2
      AND s.revoked_at IS NULL AND s.expires_at > NOW()`, parameters);
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
    return pool.query("SELECT id, name, email, password_hash, role, program_id FROM users WHERE email = $1", parameters);
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
module.exports = { findProgram, findSessionUser, findExistingEmail, insertUser, findUserByEmail, insertSession, revokeSession };
