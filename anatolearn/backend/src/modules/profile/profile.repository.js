const pool = require('../../db');
async function findProfile(parameters) {
    return pool.query(`SELECT u.id, u.name, u.email, u.role, u.program_id, p.name AS program_name, u.created_at, u.last_login_at, (u.mfa_enabled_at IS NOT NULL) AS mfa_enabled,
      cardinality(u.mfa_recovery_hashes) AS mfa_recovery_codes_left
      FROM users u LEFT JOIN programs p ON p.id = u.program_id WHERE u.id = $1`, parameters);
}
async function findPasswordHash(parameters) { return pool.query('SELECT password_hash FROM users WHERE id = $1', parameters); }
async function updateProfile(parameters) { return pool.query('UPDATE users SET name = $2, program_id = $3 WHERE id = $1 RETURNING id', parameters); }
async function findProgram(parameters) { return pool.query('SELECT id FROM programs WHERE id = $1', parameters); }
async function setPassword(parameters) {
    return pool.query('UPDATE users SET password_hash = $2, password_changed_at = NOW() WHERE id = $1', parameters);
}
async function revokeOtherSessions(parameters) {
    return pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL', parameters);
}
async function revokeAllSessions(parameters) { return pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', parameters); }
async function countOtherActiveTeachers(parameters) {
    return pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'teacher' AND is_active AND id <> $1", parameters);
}
async function countOtherActiveAdmins(parameters) {
    return pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND is_active AND id <> $1", parameters);
}
async function deleteUser(parameters) { return pool.query('DELETE FROM users WHERE id = $1', parameters); }
async function exportData(userId) {
    const [attempts, answers, favorites, activity, downloads] = await Promise.all([
        pool.query('SELECT id, quiz_id, score, total_questions, correct_count, status, attempted_at FROM quiz_attempts WHERE student_id = $1 ORDER BY id', [userId]),
        pool.query(`SELECT a.attempt_id, a.question_id, a.selected_option, a.answer_text, a.is_correct, a.teacher_score FROM quiz_attempt_answers a
          JOIN quiz_attempts t ON t.id = a.attempt_id WHERE t.student_id = $1 ORDER BY a.id`, [userId]),
        pool.query('SELECT item_type, item_id, created_at FROM favorites WHERE user_id = $1', [userId]),
        pool.query('SELECT item_type, item_id, view_count, last_viewed_at FROM user_activity WHERE user_id = $1', [userId]),
        pool.query('SELECT model_id, downloaded_at FROM downloads WHERE downloaded_by = $1', [userId]),
    ]);
    return { quiz_attempts: attempts.rows, quiz_answers: answers.rows, favorites: favorites.rows, activity: activity.rows, model_downloads: downloads.rows };
}
async function findMfaState(parameters) {
    return pool.query('SELECT email, mfa_secret, mfa_pending_secret, mfa_last_step, mfa_enabled_at FROM users WHERE id = $1', parameters);
}
async function setPendingMfaSecret(parameters) { return pool.query('UPDATE users SET mfa_pending_secret = $2 WHERE id = $1 AND mfa_enabled_at IS NULL', parameters); }
async function enableMfa(parameters) {
    return pool.query(`UPDATE users SET mfa_secret = mfa_pending_secret, mfa_pending_secret = NULL, mfa_enabled_at = NOW(), mfa_last_step = $2,
      mfa_recovery_hashes = $3 WHERE id = $1 AND mfa_pending_secret IS NOT NULL AND mfa_enabled_at IS NULL RETURNING id`, parameters);
}
async function disableMfa(parameters) {
    return pool.query(`UPDATE users SET mfa_secret = NULL, mfa_pending_secret = NULL, mfa_enabled_at = NULL, mfa_last_step = NULL,
      mfa_recovery_hashes = '{}' WHERE id = $1`, parameters);
}
async function replaceRecoveryCodes(parameters) { return pool.query('UPDATE users SET mfa_recovery_hashes = $2 WHERE id = $1', parameters); }
module.exports = { findMfaState, setPendingMfaSecret, enableMfa, disableMfa, replaceRecoveryCodes, findProfile, findPasswordHash, updateProfile, findProgram, setPassword, revokeOtherSessions, revokeAllSessions, countOtherActiveTeachers, countOtherActiveAdmins, deleteUser, exportData };
