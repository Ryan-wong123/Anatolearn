const repository = require('./quizzes.repository');
const { visibleRows, paged } = require('../catalog/catalog.service');
const catalog = require('../catalog/catalog.repository');
const { canManage } = require('../../ownership');
async function setTimer(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const seconds = input.body.time_limit_seconds;
    if (seconds !== null && (!Number.isInteger(seconds) || seconds < 30 || seconds > 86400))
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Timer must be 30–86400 seconds, or null' } });
    const quiz = (await repository.updateTimer([seconds, input.params.id])).rows[0];
    if (!quiz)
        return ({ ...outcomeMeta, status: 404, kind: 'status' });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: quiz });
}
async function listQuizzes(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { published } = input.query;
    if (published === "true" || input.user.role === "student") {
        const result = await repository.listPublished();
        return ({ ...outcomeMeta, status: 200, kind: 'json', ...paged(input, await visibleRows(input, result.rows)) });
    }
    const result = await repository.listAll();
    return ({ ...outcomeMeta, status: 200, kind: 'json', ...paged(input, await visibleRows(input, result.rows)) });
}
async function listQuestions(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    // Students must never receive the answer key while attempting a quiz. The key goes only to the teacher who manages the
    // quiz (to prefill the question editor), not to other teachers who can merely read a published quiz.
    const quiz = (await catalog.findContent([input.params.id], 'quizzes')).rows[0];
    const result = await repository.listQuestions([input.params.id], canManage(input.user, quiz));
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
async function createQuiz(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { title, description, type, category, program_id } = input.body;
    if (!title || !type) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title and type are required" } });
    }
    try {
        const result = await repository.insertQuiz([title, description || null, type, category || null, program_id || null, input.user.id]);
        return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to create quiz:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Failed to create quiz" } });
    }
}
async function updateQuiz(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { title, description, category } = input.body;
    if (!title) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title is required" } });
    }
    const result = await repository.updateQuiz([title, description || null, category || null, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Quiz not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function deleteQuiz(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.deleteQuiz([input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Quiz not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: "Quiz deleted" } });
}
async function setType(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { type } = input.body;
    if (!["MCQ", "Practical", "Mixed"].includes(type)) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "type must be MCQ, Practical, or Mixed" } });
    }
    const result = await repository.updateType([type, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Quiz not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function setPublication(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { is_published } = input.body;
    const result = await repository.updatePublication([is_published, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Quiz not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function listAttempts(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listAttempts([input.params.id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
async function listPendingAttempts(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listPendingAttempts([input.params.id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
async function listMyAttempts(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listStudentAttempts([input.user.id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
async function getAttemptAnswers(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listAttemptAnswers([input.params.id]);
    if (input.user.role === 'teacher')
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
    // Students see what they chose and whether it was right straight away, but the answer key (correct option and model
    // answer) only once the whole attempt is marked. Until then a student on a mixed quiz could read the key and retake
    // the quiz with perfect answers before the teacher has reviewed the open-ended questions.
    const attempt = (await repository.findAttempt([input.params.id])).rows[0];
    const marked = attempt?.status === 'graded';
    const rows = result.rows.map((row) => marked ? row : { ...row, correct_option: null, model_answer: null });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: rows });
}
async function getAttempt(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.findAttempt([input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Attempt not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
module.exports = { setTimer, listQuizzes, listQuestions, createQuiz, updateQuiz, deleteQuiz, setType, setPublication, listAttempts, listPendingAttempts, listMyAttempts, getAttemptAnswers, getAttempt };
