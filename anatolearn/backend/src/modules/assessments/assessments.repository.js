const pool = require('../../db');
async function closeOwnedSession(parameters) {
    return pool.query('UPDATE quiz_sessions SET submitted_at=NOW() WHERE id=$1 AND student_id=$2 AND submitted_at IS NULL', parameters);
}
async function begin(connection) {
    return connection.query('BEGIN');
}
async function findQuizForShare(parameters, connection) {
    return connection.query('SELECT * FROM quizzes WHERE id=$1 FOR SHARE', parameters);
}
async function rollback(connection) {
    return connection.query('ROLLBACK');
}
async function listQuizQuestions(parameters, connection) {
    return connection.query('SELECT * FROM quiz_questions WHERE quiz_id=$1 ORDER BY id', parameters);
}
async function insertSession(parameters, connection) {
    return connection.query(`INSERT INTO quiz_sessions (id,quiz_id,student_id,expires_at,questions,session_expires_at)
        VALUES ($1,$2,$3,CASE WHEN $4::int IS NULL THEN NULL ELSE NOW()+$4*INTERVAL '1 second' END,$5,NOW()+GREATEST($6::int*3600,COALESCE($4,0)+10)*INTERVAL '1 second') RETURNING *, NOW() AS server_now`, parameters);
}
async function commit(connection) {
    return connection.query('COMMIT');
}
async function lockOwnedSession(parameters, connection) {
    return connection.query('SELECT *, NOW() AS server_now FROM quiz_sessions WHERE id=$1 AND quiz_id=$2 AND student_id=$3 FOR UPDATE', parameters);
}
async function lockStartForStudent(parameters, connection) {
    return connection.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', parameters);
}
async function findActiveSession(parameters, connection) {
    return connection.query(`SELECT *, NOW() AS server_now FROM quiz_sessions
        WHERE quiz_id=$1 AND student_id=$2 AND submitted_at IS NULL
          AND session_expires_at > NOW() AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY started_at DESC, id DESC LIMIT 1 FOR UPDATE`, parameters);
}
async function findLatestSessionForStudent(parameters) {
    return pool.query(`SELECT *, NOW() AS server_now FROM quiz_sessions
        WHERE quiz_id=$1 AND student_id=$2 ORDER BY started_at DESC, id DESC LIMIT 1`, parameters);
}
async function lockOwnedDraft(parameters, connection) {
    return connection.query('SELECT *, NOW() AS server_now FROM quiz_sessions WHERE id=$1 AND student_id=$2 FOR UPDATE', parameters);
}
async function saveDraft(parameters, connection) {
    return connection.query(`UPDATE quiz_sessions SET draft_answers=$3::jsonb, draft_revision=$4, draft_saved_at=NOW()
        WHERE id=$1 AND student_id=$2 AND draft_revision < $4 RETURNING draft_revision, draft_saved_at`, parameters);
}
async function insertAttempt(parameters, connection) {
    return connection.query(`INSERT INTO quiz_attempts(quiz_id,student_id,score,total_questions,correct_count,status)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, parameters);
}
async function insertAnswer(parameters, connection) {
    return connection.query(`INSERT INTO quiz_attempt_answers(attempt_id,question_id,selected_option,answer_text,is_correct,teacher_score,answer_json,region_review)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, parameters);
}
async function completeSession(parameters, connection) {
    return connection.query('UPDATE quiz_sessions SET submitted_at=NOW() WHERE id=$1', parameters);
}
async function findAnswerWithFormat(parameters, connection) {
    return connection.query(`SELECT a.*,q.format FROM quiz_attempt_answers a JOIN quiz_questions q ON q.id=a.question_id WHERE a.id=$1`, parameters);
}
async function lockAttempt(parameters, connection) {
    return connection.query('SELECT id FROM quiz_attempts WHERE id=$1 FOR UPDATE', parameters);
}
async function updateAnswerGrade(parameters, connection) {
    return connection.query('UPDATE quiz_attempt_answers SET teacher_score=$1,is_correct=$2 WHERE id=$3 RETURNING *', parameters);
}
async function listAttemptAnswers(parameters, connection) {
    return connection.query(`SELECT a.*,q.format FROM quiz_attempt_answers a JOIN quiz_questions q ON q.id=a.question_id WHERE a.attempt_id=$1`, parameters);
}
async function updateAttemptGrade(parameters, connection) {
    return connection.query("UPDATE quiz_attempts SET score=$1,status='graded',correct_count=$2 WHERE id=$3", parameters);
}
module.exports = { findLatestSessionForStudent, lockStartForStudent, findActiveSession, lockOwnedDraft, saveDraft, closeOwnedSession, begin, findQuizForShare, rollback, listQuizQuestions, insertSession, commit, lockOwnedSession, insertAttempt, insertAnswer, completeSession, findAnswerWithFormat, lockAttempt, updateAnswerGrade, listAttemptAnswers, updateAttemptGrade };
