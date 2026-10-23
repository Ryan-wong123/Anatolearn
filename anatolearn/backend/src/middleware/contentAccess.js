const repository = require('../modules/catalog/catalog.repository');
const { canRead } = require('../access');
const pool = require('../db');
const SINGULAR = { models: 'model', videos: 'video', quizzes: 'quiz', resources: 'resource' };
// Remembers what each student opens so the dashboard can offer "continue where you left off".
function recordView(user, kind, id) {
    void pool.query(`INSERT INTO user_activity(user_id, item_type, item_id) VALUES ($1, $2, $3)
      ON CONFLICT (user_id, item_type, item_id) DO UPDATE SET view_count = user_activity.view_count + 1, last_viewed_at = NOW()`,
    [user.id, SINGULAR[kind], Number(id)]).catch((error) => console.error('Activity write failed:', error.message));
}
module.exports = (req, res, next) => {
    (async () => {
        const content = req.path.match(/^\/(models|videos|quizzes|resources)\/(\d+)(?:\/|$)/);
        if (content && (req.method === 'GET' || /\/(submit|start)$/.test(req.path))) {
            const row = (await repository.findContent([content[2]], content[1])).rows[0];
            if (!row || !canRead(req.user, row))
                return res.status(404).json({ message: 'Content not found or unavailable' });
            if (req.user.role === 'student' && ((req.method === 'GET' && /^\/[a-z]+\/\d+(?:\/questions)?\/?$/.test(req.path)) || /\/start$/.test(req.path)))
                recordView(req.user, content[1], content[2]);
        }
        const attempt = req.path.match(/^\/attempts\/(\d+)(?:\/|$)/);
        if (attempt) {
            const row = (await repository.findAttemptOwner([attempt[1]])).rows[0];
            if (!row || (req.user.role !== 'teacher' && row.student_id !== req.user.id))
                return res.status(404).json({ message: 'Attempt not found' });
        }
        next();
    })().catch(next);
};
