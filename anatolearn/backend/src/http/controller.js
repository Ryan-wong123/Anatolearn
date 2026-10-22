const storage = require('../storage');
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
            file: req.file,
            files: req.files,
        });
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
