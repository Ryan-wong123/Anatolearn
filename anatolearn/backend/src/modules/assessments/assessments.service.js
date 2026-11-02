const repository = require('./assessments.repository');
const { randomUUID } = require('crypto');
const { canRead } = require('../../access');
const { SESSION_LIFETIME_HOURS } = require('../../maintenance');
const pool = require('../../db');
const { FORMATS, valid3DAnswer, gradeRegion, gradeMatching } = require('./threeDGrading');
function validateAnswers(questions, answers) {
    if (!Array.isArray(answers) || answers.length !== questions.length)
        return false;
    const ids = new Set();
    return answers.every((answer) => {
        const question = questions.find((item) => item.id === answer.question_id);
        if (!question || ids.has(answer.question_id))
            return false;
        ids.add(answer.question_id);
        return question.format === 'mcq'
            ? answer.selected_option == null || ['A', 'B', 'C', 'D'].includes(answer.selected_option)
            : FORMATS.includes(question.format) ? valid3DAnswer(question, answer.answer_json)
            : answer.answer_text == null || (typeof answer.answer_text === 'string' && answer.answer_text.length <= 20000);
    });
}
async function cancelSession(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    if (!/^[0-9a-f-]{36}$/i.test(input.params.id))
        return ({ ...outcomeMeta, status: 400, kind: 'status' });
    await repository.closeOwnedSession([input.params.id, input.user.id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: 'Session closed' } });
}
async function startQuiz(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    if (input.user.role !== 'student')
        return ({ ...outcomeMeta, status: 403, kind: 'status' });
    const client = await pool.connect();
    try {
        await repository.begin(client);
        const quiz = (await repository.findQuizForShare([input.params.id], client)).rows[0];
        if (!quiz || !canRead(input.user, quiz)) {
            await repository.rollback(client);
            return ({ ...outcomeMeta, status: 404, kind: 'status' });
        }
        const questions = (await repository.listQuizQuestions([quiz.id], client)).rows;
        if (!questions.length) {
            await repository.rollback(client);
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'This quiz has no questions' } });
        }
        // Snapshot ground truth into the immutable timed session. The student receives only
        // model_id, marker numbers and shuffled options, never the reference region/key.
        for (const question of questions) {
            if (!FORMATS.includes(question.format)) continue;
            const c = question.question_config;
            if (question.format === 'region_identification') {
                const { rows } = await client.query('SELECT annotation_data FROM annotations WHERE id=$1 AND model_id=$2', [c.reference_annotation_id,c.model_id]);
                if (!rows[0]?.annotation_data?.projectedMask) throw Object.assign(new Error('Region reference is unavailable'),{status:409});
                const {cachedGeometry, ...mask} = rows[0].annotation_data.projectedMask;
                question.reference_mask = {projectedMask:mask};
                question.student_config = {model_id:c.model_id};
            } else {
                const {rows} = await client.query('SELECT id,label FROM annotations WHERE model_id=$1 AND id=ANY($2::int[])', [c.model_id,c.annotation_ids]);
                if (rows.length !== c.annotation_ids.length) throw Object.assign(new Error('Matching references are unavailable'),{status:409});
                const key = Object.fromEntries(rows.map(row => [String(row.id),row.label]));
                question.matching_key = key;
                const options = Object.values(key);
                for(let i=options.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
                question.student_config = {model_id:c.model_id,marker_ids:c.annotation_ids,options};
            }
        }
        const id = randomUUID();
        const result = await repository.insertSession([id, quiz.id, input.user.id, quiz.time_limit_seconds, JSON.stringify(questions), SESSION_LIFETIME_HOURS], client);
        await repository.commit(client);
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: { session_id: id, expires_at: result.rows[0].expires_at, server_now: result.rows[0].server_now, session_expires_at: result.rows[0].session_expires_at,
                questions: questions.map(({ correct_option, model_answer, question_config, reference_mask, matching_key, ...question }) => question) } });
    }
    catch (error) {
        await repository.rollback(client);
        throw error;
    }
    finally {
        client.release();
    }
}
async function submitQuiz(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    if (input.user.role !== 'student')
        return ({ ...outcomeMeta, status: 403, kind: 'status' });
    if (typeof input.body.session_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.body.session_id))
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Start the quiz before submitting' } });
    const client = await pool.connect();
    try {
        await repository.begin(client);
        const session = (await repository.lockOwnedSession([input.body.session_id, input.params.id, input.user.id], client)).rows[0];
        if (!session || session.submitted_at) {
            await repository.rollback(client);
            return ({ ...outcomeMeta, status: 409, kind: 'json', body: { message: 'Quiz session is unavailable or already submitted' } });
        }
        // A short transport grace allows the automatic timeout submission to arrive.
        if (new Date(session.server_now) >= new Date(session.session_expires_at) || (session.expires_at && new Date(session.server_now) > new Date(session.expires_at).getTime() + 10000)) {
            await repository.rollback(client);
            return ({ ...outcomeMeta, status: 409, kind: 'json', body: { message: 'Quiz time limit has expired. Start a new attempt.' } });
        }
        const questions = session.questions;
        if (!validateAnswers(questions, input.body.answers)) {
            await repository.rollback(client);
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Submit each session question exactly once with a valid answer' } });
        }
        const answers = input.body.answers.map((answer) => {
            const question = questions.find((item) => item.id === answer.question_id);
            const mcq = question.format === 'mcq';
            const threeD = FORMATS.includes(question.format);
            const result = question.format === 'region_identification'
                ? gradeRegion(question.reference_mask,answer.answer_json)
                : question.format === 'annotation_matching'
                ? gradeMatching(question.matching_key,answer.answer_json) : null;
            // Capture the reference from this session (not the mutable live annotation).
            // The snapshot is only exposed after the student has submitted.
            const regionReview = question.format === 'region_identification' ? {
                model_id: question.student_config.model_id,
                reference_annotation_id: question.question_config.reference_annotation_id,
                reference_mask: question.reference_mask.projectedMask,
                details: result.details,
            } : null;
            return { ...answer, format:question.format, is_correct:mcq ? question.correct_option === answer.selected_option : threeD ? result.correct : null,
                points:result?.score ?? null, details:result?.details ?? null, regionReview };
        });
        const openCount = questions.filter(q => q.format === 'open_ended').length;
        const correct = answers.filter(a => a.is_correct).length;
        const status = openCount ? 'pending_review' : 'graded';
        const score = openCount ? null : Math.round(answers.reduce((sum,a) => sum + (a.format === 'mcq' ? (a.is_correct ? 100 : 0) : a.points ?? 0),0) / questions.length);
        const attempt = (await repository.insertAttempt([input.params.id, input.user.id, score, questions.length, openCount ? null : correct, status], client)).rows[0];
        for (const answer of answers)
            await repository.insertAnswer([attempt.id, answer.question_id, answer.selected_option || null, answer.answer_text || null, answer.is_correct,
                answer.points,answer.answer_json ? JSON.stringify(answer.answer_json) : null,
                answer.regionReview ? JSON.stringify(answer.regionReview) : null], client);
        await repository.completeSession([session.id], client);
        await repository.commit(client);
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: { attempt, status, score, total: questions.length, correct: openCount ? null : correct,
                incorrect: openCount ? null : questions.length - correct, mcq_count: questions.filter(q=>q.format==='mcq').length, open_ended_count: openCount,
                // The key is withheld while open-ended answers still await marking (see getAttemptAnswers).
                feedback: answers.filter(a => a.is_correct !== null).map(a => ({ question_id:a.question_id, format:a.format, selected_option:a.selected_option||null, is_correct:a.is_correct, score:a.points, details:a.details,
                    // Deliberately return only in the SUBMISSION response; never in startQuiz.
                    region_review:a.regionReview,
                    correct_option: openCount ? null : questions.find(q => q.id === a.question_id).correct_option })) } });
    }
    catch (error) {
        await repository.rollback(client);
        throw error;
    }
    finally {
        client.release();
    }
}
async function gradeAnswer(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const score = input.body.teacher_score;
    if (!Number.isFinite(score) || score < 0 || score > 100)
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Score must be 0–100' } });
    const client = await pool.connect();
    try {
        await repository.begin(client);
        const answer = (await repository.findAnswerWithFormat([input.params.id], client)).rows[0];
        if (!answer || answer.format !== 'open_ended') {
            await repository.rollback(client);
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Only open-ended answers can be manually graded' } });
        }
        await repository.lockAttempt([answer.attempt_id], client);
        const updated = (await repository.updateAnswerGrade([score, score >= 50, answer.id], client)).rows[0];
        const answers = (await repository.listAttemptAnswers([answer.attempt_id], client)).rows;
        if (answers.every((a) => a.format !== 'open_ended' || a.teacher_score != null)) {
            const finalScore = Math.round(answers.reduce((sum, a) => sum + (a.format === 'mcq' ? (a.is_correct ? 100 : 0) : a.teacher_score), 0) / answers.length);
            await repository.updateAttemptGrade([finalScore, answers.filter((a) => a.is_correct).length, answer.attempt_id], client);
        }
        await repository.commit(client);
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: updated });
    }
    catch (error) {
        await repository.rollback(client);
        throw error;
    }
    finally {
        client.release();
    }
}
module.exports = { cancelSession, startQuiz, submitQuiz, gradeAnswer, validateAnswers };
