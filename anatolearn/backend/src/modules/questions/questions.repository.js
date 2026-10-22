const { ACTIVE_QUIZ_SESSION } = require('../../maintenance');
const pool = require('../../db');
async function begin(connection) {
    return connection.query('BEGIN');
}
async function lockQuiz(parameters, connection) {
    return connection.query('SELECT id FROM quizzes WHERE id=$1 FOR UPDATE', parameters);
}
async function findQuizUsage(parameters, connection) {
    return connection.query(`SELECT 1 FROM quiz_attempts WHERE quiz_id=$1 UNION ALL
      SELECT 1 FROM quiz_sessions WHERE quiz_id=$1 AND ${ACTIVE_QUIZ_SESSION} LIMIT 1`, parameters);
}
async function updateDerivedQuizType(parameters, connection) {
    return connection.query(`UPDATE quizzes SET type=COALESCE((SELECT CASE WHEN COUNT(*)=0 THEN 'MCQ' WHEN bool_and(format='mcq') THEN 'MCQ' WHEN bool_and(format='open_ended') THEN 'Practical' ELSE 'Mixed' END::quiz_type FROM quiz_questions WHERE quiz_id=$1),'MCQ') WHERE id=$1`, parameters);
}
async function commit(connection) {
    return connection.query('COMMIT');
}
async function rollback(connection) {
    return connection.query('ROLLBACK');
}
async function insertQuestion(parameters, connection) {
    return connection.query(`INSERT INTO quiz_questions(question,format,category,option_a,option_b,option_c,option_d,correct_option,model_answer,quiz_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, parameters);
}
async function findQuestionQuiz(parameters) {
    return pool.query('SELECT quiz_id FROM quiz_questions WHERE id=$1', parameters);
}
async function updateQuestion(parameters, connection) {
    return connection.query(`UPDATE quiz_questions SET question=$1,format=$2,category=$3,option_a=$4,option_b=$5,option_c=$6,option_d=$7,correct_option=$8,model_answer=$9 WHERE id=$10 RETURNING *`, parameters);
}
async function deleteQuestion(parameters, connection) {
    return connection.query('DELETE FROM quiz_questions WHERE id=$1', parameters);
}
module.exports = { begin, lockQuiz, findQuizUsage, updateDerivedQuizType, commit, rollback, insertQuestion, findQuestionQuiz, updateQuestion, deleteQuestion };
