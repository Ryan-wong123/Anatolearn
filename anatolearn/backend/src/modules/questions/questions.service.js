const repository = require('./questions.repository');
const { validQuestion } = require('./question.validation');
const pool = require('../../db');
async function withEditableQuiz(pool, quizId, operation) {
    const client = await pool.connect();
    try {
        await repository.begin(client);
        const quiz = (await repository.lockQuiz([quizId], client)).rows[0];
        if (!quiz)
            throw Object.assign(new Error('Quiz not found'), { status: 404 });
        const used = await repository.findQuizUsage([quizId], client);
        if (used.rows.length)
            throw Object.assign(new Error('This quiz has attempts or active sessions. Create a new quiz to change questions.'), { status: 409 });
        const result = await operation(client);
        await repository.updateDerivedQuizType([quizId], client);
        await repository.commit(client);
        return result;
    }
    catch (error) {
        await repository.rollback(client);
        throw error;
    }
    finally {
        client.release();
    }
}
function values(q) {
    return [q.question.trim(), q.format, q.category || null,
        q.format === 'mcq' ? q.option_a : null, q.format === 'mcq' ? q.option_b : null,
        q.format === 'mcq' ? q.option_c : null, q.format === 'mcq' ? q.option_d : null,
        q.format === 'mcq' ? q.correct_option : null, q.format === 'open_ended' ? q.model_answer : null];
}
async function createQuestion(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const q = { ...input.body, format: input.body.format || 'mcq' };
    if (!validQuestion(q))
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Complete the question, its options and answer key' } });
    const result = await withEditableQuiz(pool, input.params.id, async (client) => (await repository.insertQuestion([...values(q), input.params.id], client)).rows[0]);
    return ({ ...outcomeMeta, status: 201, kind: 'json', body: result });
}
async function updateQuestion(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const q = { ...input.body, format: input.body.format || 'mcq' };
    if (!validQuestion(q))
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Complete the question, its options and answer key' } });
    const quiz = (await repository.findQuestionQuiz([input.params.id])).rows[0];
    if (!quiz)
        return ({ ...outcomeMeta, status: 404, kind: 'status' });
    const result = await withEditableQuiz(pool, quiz.quiz_id, async (client) => (await repository.updateQuestion([...values(q), input.params.id], client)).rows[0]);
    if (!result)
        return ({ ...outcomeMeta, status: 404, kind: 'status' });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result });
}
async function deleteQuestion(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const quiz = (await repository.findQuestionQuiz([input.params.id])).rows[0];
    if (!quiz)
        return ({ ...outcomeMeta, status: 404, kind: 'status' });
    await withEditableQuiz(pool, quiz.quiz_id, (client) => repository.deleteQuestion([input.params.id], client));
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: 'Question deleted' } });
}
module.exports = { createQuestion, updateQuestion, deleteQuestion, withEditableQuiz };
