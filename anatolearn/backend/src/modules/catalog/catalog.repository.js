const pool = require('../../db');
async function findProgram(parameters) {
    return pool.query('SELECT id FROM programs WHERE id=$1', parameters);
}
function contentTable(kind) {
    if (!['models', 'videos', 'quizzes', 'resources'].includes(kind)) throw new Error('Unsupported content type');
    return kind;
}
async function updateContentProgram(parameters, kind) {
    return pool.query(`UPDATE ${contentTable(kind)} SET program_id=$1 WHERE id=$2 RETURNING *`, parameters);
}
async function findProgramByName(parameters) {
    return pool.query('SELECT id FROM programs WHERE name = $1', parameters);
}
async function findContent(parameters, kind) {
    return pool.query(`SELECT * FROM ${contentTable(kind)} WHERE id = $1`, parameters);
}
async function findAttemptOwner(parameters) {
    return pool.query('SELECT student_id FROM quiz_attempts WHERE id = $1', parameters);
}
module.exports = { findProgram, updateContentProgram, findProgramByName, findContent, findAttemptOwner };
