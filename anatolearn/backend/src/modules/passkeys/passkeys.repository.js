const pool = require('../../db');
async function list(parameters) {
    return pool.query('SELECT id, name, device_type, backed_up, created_at, last_used_at FROM passkeys WHERE user_id = $1 ORDER BY id', parameters);
}
async function listCredentials(parameters) {
    return pool.query('SELECT id, credential_id, public_key, counter, transports FROM passkeys WHERE user_id = $1', parameters);
}
async function findCredential(parameters) {
    return pool.query('SELECT id, credential_id, public_key, counter, transports FROM passkeys WHERE user_id = $1 AND credential_id = $2', parameters);
}
async function insert(parameters) {
    return pool.query(`INSERT INTO passkeys(user_id, credential_id, public_key, counter, transports, name, device_type, backed_up)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (credential_id) DO NOTHING RETURNING id, name, created_at`, parameters);
}
async function remove(parameters) {
    return pool.query('DELETE FROM passkeys WHERE id = $1 AND user_id = $2 RETURNING id', parameters);
}
async function recordUse(parameters) {
    return pool.query('UPDATE passkeys SET counter = $2, last_used_at = NOW() WHERE id = $1', parameters);
}
async function countByUser(parameters) {
    return pool.query('SELECT count(*)::int AS n FROM passkeys WHERE user_id = $1', parameters);
}
async function hasTotp(parameters) {
    return pool.query('SELECT (mfa_enabled_at IS NOT NULL) AS totp FROM users WHERE id = $1', parameters);
}
async function saveChallenge(parameters) {   // [id, userId, purpose, challenge, minutes]; replaces any earlier pending challenge
    await pool.query('DELETE FROM webauthn_challenges WHERE (user_id = $1 AND purpose = $2) OR expires_at < NOW()', [parameters[1], parameters[2]]);
    return pool.query(`INSERT INTO webauthn_challenges(id, user_id, purpose, challenge, expires_at) VALUES ($1,$2,$3,$4,NOW() + $5 * INTERVAL '1 minute')`, parameters);
}
// Single use: returns the pending, unexpired challenge and deletes it.
async function takeChallenge(parameters) {   // [userId, purpose]
    const { rows } = await pool.query('DELETE FROM webauthn_challenges WHERE user_id = $1 AND purpose = $2 RETURNING challenge, expires_at > NOW() AS fresh', parameters);
    return rows.find((row) => row.fresh)?.challenge ?? null;
}
async function findUser(parameters) {
    return pool.query('SELECT id, name, email, role, program_id, is_active, (locked_until > NOW()) AS is_locked FROM users WHERE id = $1', parameters);
}
module.exports = { list, listCredentials, findCredential, insert, remove, recordUse, countByUser, hasTotp, saveChallenge, takeChallenge, findUser };
