const { FORMATS, valid3DAnswer } = require('./threeDGrading');
// Draft responses are never graded here. Validate against the immutable session
// question snapshot so clients cannot store answers for arbitrary questions.
function validDraftAnswers(questions, answers) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
    if (JSON.stringify(answers).length > 1000000) return false;
    const byId = new Map(questions.map((question) => [String(question.id), question]));
    return Object.entries(answers).every(([id, raw]) => {
        const question = byId.get(id);
        if (!question || typeof raw !== 'string') return false;
        if (!raw) return true; // Clearing a response is allowed.
        if (question.format === 'mcq') return ['A', 'B', 'C', 'D'].includes(raw);
        if (question.format === 'open_ended') return raw.length <= 20000;
        if (!FORMATS.includes(question.format) || raw.length > 150000) return false;
        try { return Boolean(valid3DAnswer(question, JSON.parse(raw))); } catch { return false; }
    });
}
module.exports = { validDraftAnswers };
