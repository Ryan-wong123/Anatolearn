const pool = require('../../db');
async function updateTimer(parameters) {
    return pool.query('UPDATE quizzes SET time_limit_seconds=$1 WHERE id=$2 RETURNING *', parameters);
}
async function listPublished() {
    return pool.query("SELECT * FROM quizzes WHERE is_published = true ORDER BY id");
}
async function listAll() {
    return pool.query("SELECT * FROM quizzes ORDER BY id");
}
async function listQuestions(parameters, includeAnswerKeys) {
    const columns = includeAnswerKeys
        ? 'id, quiz_id, question, format, option_a, option_b, option_c, option_d, correct_option, model_answer, question_config'
        : 'id, quiz_id, question, format, option_a, option_b, option_c, option_d';
    return pool.query(`SELECT ${columns} FROM quiz_questions WHERE quiz_id = $1 ORDER BY id`, parameters);
}
async function insertQuiz(parameters) {
    return pool.query(`INSERT INTO quizzes (title, description, type, category, program_id, is_published, owner_id)
       VALUES ($1, $2, $3, $4, $5, false, $6)
       RETURNING *`, parameters);
}
async function updateQuiz(parameters) {
    return pool.query(`UPDATE quizzes SET title = $1, description = $2, category = $3 WHERE id = $4 RETURNING *`, parameters);
}
async function deleteQuiz(parameters) {
    return pool.query("DELETE FROM quizzes WHERE id = $1 RETURNING *", parameters);
}
async function updateType(parameters) {
    return pool.query(`UPDATE quizzes SET type = $1 WHERE id = $2 RETURNING *`, parameters);
}
async function updatePublication(parameters) {
    return pool.query(`UPDATE quizzes SET is_published = $1 WHERE id = $2 RETURNING *`, parameters);
}
async function listAttempts(parameters) {
    return pool.query(`SELECT qa.*, u.name AS student_name FROM quiz_attempts qa LEFT JOIN users u ON u.id=qa.student_id WHERE quiz_id=$1 ORDER BY attempted_at DESC`, parameters);
}
async function listPendingAttempts(parameters) {
    return pool.query(`SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND status = 'pending_review' ORDER BY attempted_at`, parameters);
}
async function listStudentAttempts(parameters) {
    return pool.query(`SELECT qa.id, qa.quiz_id, q.title AS quiz_title, qa.score, qa.status, qa.attempted_at
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.student_id = $1
     ORDER BY qa.attempted_at DESC`, parameters);
}
async function listAttemptAnswers(parameters) {
    return pool.query(`SELECT qaa.*, qq.question, qq.format, qq.model_answer, qq.correct_option, qq.option_a, qq.option_b, qq.option_c, qq.option_d
     FROM quiz_attempt_answers qaa
     JOIN quiz_questions qq ON qq.id = qaa.question_id
     WHERE qaa.attempt_id = $1
     ORDER BY qaa.id`, parameters);
}
async function findAttempt(parameters) {
    return pool.query("SELECT * FROM quiz_attempts WHERE id = $1", parameters);
}
module.exports = { updateTimer, listPublished, listAll, listQuestions, insertQuiz, updateQuiz, deleteQuiz, updateType, updatePublication, listAttempts, listPendingAttempts, listStudentAttempts, listAttemptAnswers, findAttempt };

const { cachedRead } = require('../../cache');
module.exports.listPublished = cachedRead('catalog', 'quizzes.listPublished', 300, listPublished);
module.exports.listAll = cachedRead('catalog', 'quizzes.listAll', 300, listAll);
