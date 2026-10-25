const storage = require('../storage');
const { annotate } = require('../ownership');

// Teachers get can_manage and owner_name on every content row (lists, single items, creates and updates alike), so the
// browser never has to guess who may change what. Everyone else has the owner columns removed: students and administrators
// have no use for another user's id.
async function withOwnership(user, body) {
    if (body === null || typeof body !== 'object') return body;
    const rows = Array.isArray(body) ? body : [body];
    const sample = rows.find((row) => row && typeof row === 'object');
    if (!sample) return body;
    const column = 'owner_id' in sample ? 'owner_id' : 'created_by' in sample ? 'created_by' : null;
    if (!column) return body;
    const shaped = user?.role === 'teacher' ? await annotate(user, rows, column)
        : rows.map(({ [column]: _hidden, ...rest }) => rest);
    return Array.isArray(body) ? shaped : shaped[0];
}
// Adapt plain service inputs/results to Express in one place. Services never
// receive the live request or response, so they can also be called from tests.
function controller(operation) {
    return async (req, res) => {
        const result = await operation({
            body: req.body,
            params: req.params,
            query: req.query,
            user: req.user,
            headers: req.headers,
            path: req.path,
            ip: req.ip,
            file: req.file,
            files: req.files,
        });
        if (result.kind === 'json' && result.status < 400) result.body = await withOwnership(req.user, result.body);
        for (const [name, value] of Object.entries(result.headers || {}))
            res.setHeader(name, value);
        for (const cookie of result.cookies || []) {
            if (cookie.clear)
                res.clearCookie(cookie.name, cookie.options);
            else
                res.cookie(cookie.name, cookie.value, cookie.options);
        }
        res.status(result.status);
        switch (result.kind) {
            case 'status': return res.sendStatus(result.status);
            case 'send': return res.send(result.body);
            case 'file': return res.sendFile(result.path);
            case 'object': return storage.sendObject(res, result.assetPath, { range: req.headers.range, filename: result.filename });
            case 'download':
                return res.download(result.path, result.filename, (error) => {
                    if (error && !res.headersSent) {
                        console.error('Failed to send model file:', error);
                        res.status(500).json({ message: 'Failed to download model file' });
                    }
                });
            default: return res.json(result.body);
        }
    };
}
module.exports = { controller };
