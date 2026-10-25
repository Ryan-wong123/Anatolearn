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
// Match against the decoded path: Express decodes route params, so "/quizzes/%35" reaches the same handler as "/quizzes/5".
function decodedPath(req) {
    // Repeated slashes are collapsed once here so the patterns below can stay simple (and linear-time).
    try { return decodeURIComponent(req.path).replace(/\/+/g, '/'); } catch { return null; }
}
module.exports = (req, res, next) => {
    (async () => {
        const path = decodedPath(req);
        if (path === null) return res.status(400).json({ message: 'Malformed request path' });
        const reads = ['GET', 'HEAD'].includes(req.method);
        const content = path.match(/^\/(models|videos|quizzes|resources)\/([^/]+)(?:\/|$)/i);
        if (content && (reads || /\/(submit|start|progress)\/?$/i.test(path))) {
            const kind = content[1].toLowerCase();
            const row = /^\d+$/.test(content[2]) ? (await repository.findContent([content[2]], kind)).rows[0] : null;
            if (!row || !canRead(req.user, row))
                return res.status(404).json({ message: 'Content not found or unavailable' });
            if (req.user.role === 'student' && ((req.method === 'GET' && /^\/[a-z]+\/\d+(?:\/questions)?\/?$/i.test(path)) || /\/start\/?$/i.test(path)))
                recordView(req.user, kind, content[2]);
        }
        const attempt = path.match(/^\/attempts\/([^/]+)(?:\/|$)/i);
        if (attempt) {
            const row = /^\d+$/.test(attempt[1]) ? (await repository.findAttemptOwner([attempt[1]])).rows[0] : null;
            if (!row || (req.user.role !== 'teacher' && row.student_id !== req.user.id))
                return res.status(404).json({ message: 'Attempt not found' });
        }
        next();
    })().catch(next);
};
