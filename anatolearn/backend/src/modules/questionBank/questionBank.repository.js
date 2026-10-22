const pool = require('../../db');
async function listQuestions() {
    return pool.query('SELECT * FROM question_bank ORDER BY category NULLS LAST,id');
}
async function findQuizQuestion(parameters) {
    return pool.query('SELECT * FROM quiz_questions WHERE id=$1', parameters);
}
async function insertBankQuestion(parameters) {
    return pool.query(`INSERT INTO question_bank(question,format,category,option_a,option_b,option_c,option_d,correct_option,model_answer)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, parameters);
}
async function updateBankQuestion(parameters) {
    return pool.query(`UPDATE question_bank SET question=$1,format=$2,category=$3,option_a=$4,option_b=$5,option_c=$6,option_d=$7,correct_option=$8,model_answer=$9 WHERE id=$10 RETURNING *`, parameters);
}
async function deleteBankQuestion(parameters) {
    return pool.query('DELETE FROM question_bank WHERE id=$1', parameters);
}
async function findBankQuestion(parameters, connection) {
    return connection.query('SELECT * FROM question_bank WHERE id=$1', parameters);
}
async function insertQuizCopy(parameters, connection) {
    return connection.query(`INSERT INTO quiz_questions(quiz_id,question,format,category,option_a,option_b,option_c,option_d,correct_option,model_answer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, parameters);
}
module.exports = { listQuestions, findQuizQuestion, insertBankQuestion, updateBankQuestion, deleteBankQuestion, findBankQuestion, insertQuizCopy };
