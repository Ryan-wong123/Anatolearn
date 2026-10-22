const repository = require('../modules/catalog/catalog.repository');
const { canRead } = require('../access');
module.exports = (req, res, next) => {
    (async () => {
        const content = req.path.match(/^\/(models|videos|quizzes|resources)\/(\d+)(?:\/|$)/);
        if (content && (req.method === 'GET' || /\/(submit|start)$/.test(req.path))) {
            const row = (await repository.findContent([content[2]], content[1])).rows[0];
            if (!row || !canRead(req.user, row))
                return res.status(404).json({ message: 'Content not found or unavailable' });
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
