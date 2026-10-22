const repository = require('./questionBank.repository');
const pool = require('../../db');
const { validQuestion } = require('../questions/question.validation');
const { withEditableQuiz } = require('../questions/questions.service');
async function listQuestions(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const rows = (await repository.listQuestions()).rows;
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: rows });
}
async function saveFromQuiz(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const q = (await repository.findQuizQuestion([input.params.id])).rows[0];
    if (!q)
        return ({ ...outcomeMeta, status: 404, kind: 'status' });
    const row = (await repository.insertBankQuestion([q.question, q.format, input.body.category || q.category, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.model_answer])).rows[0];
    return ({ ...outcomeMeta, status: 201, kind: 'json', body: row });
}
async function updateQuestion(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const q = input.body;
    if (!validQuestion(q))
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Complete the question and its answer fields' } });
    const row = (await repository.updateBankQuestion([q.question, q.format, q.category || null, q.format === 'mcq' ? q.option_a : null, q.format === 'mcq' ? q.option_b : null, q.format === 'mcq' ? q.option_c : null, q.format === 'mcq' ? q.option_d : null, q.format === 'mcq' ? q.correct_option : null, q.format === 'open_ended' ? q.model_answer : null, input.params.id])).rows[0];
    if (!row)
        return ({ ...outcomeMeta, status: 404, kind: 'status' });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: row });
}
async function deleteQuestion(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    await repository.deleteBankQuestion([input.params.id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: 'Question removed from bank; quiz copies are retained' } });
}
async function importIntoQuiz(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const row = await withEditableQuiz(pool, input.params.id, async (client) => {
        const q = (await repository.findBankQuestion([input.params.bankId], client)).rows[0];
        if (!q)
            throw Object.assign(new Error('Bank question not found'), { status: 404 });
        return (await repository.insertQuizCopy([input.params.id, q.question, q.format, q.category, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.model_answer], client)).rows[0];
    });
    return ({ ...outcomeMeta, status: 201, kind: 'json', body: row });
}
module.exports = { listQuestions, saveFromQuiz, updateQuestion, deleteQuestion, importIntoQuiz, validQuestion };
