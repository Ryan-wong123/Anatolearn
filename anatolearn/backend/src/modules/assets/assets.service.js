const repository = require('./assets.repository');
const path = require('path');
const { canRead } = require('../../access');
const storage = require('../../storage');
async function getTeachingAsset(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const assetPath = decodeURIComponent(input.path);
    const candidates = await repository.findAssetOwners([assetPath]);
    let allowed = candidates.rows.some((row) => canRead(input.user, row));
    if (!allowed && assetPath.startsWith('/models/')) {
        const models = (await repository.listGltfModels()).rows;
        for (const model of models)
            if (canRead(input.user, model) && await storage.referencesAsset(model, assetPath)) {
                allowed = true;
                break;
            }
    }
    if (!allowed)
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: 'Asset not found' } });
    if (storage.REMOTE) {
        (outcomeMeta.headers['Cache-Control'] = 'private, no-store');
        (outcomeMeta.headers['X-Content-Type-Options'] = 'nosniff');
        if (/\.(docx?|usdz)$/i.test(assetPath))
            outcomeMeta.headers['Content-Disposition'] = 'attachment';
        return ({ ...outcomeMeta, status: 200, kind: 'object', assetPath });
    }
    const root = path.resolve(storage.ROOT);
    const absolute = path.resolve(root, '.' + assetPath);
    if (!absolute.startsWith(root + path.sep))
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Invalid asset path' } });
    (outcomeMeta.headers['Cache-Control'] = 'private, no-store');
    (outcomeMeta.headers['X-Content-Type-Options'] = 'nosniff');
    if (/\.(docx?|usdz)$/i.test(absolute))
        outcomeMeta.headers['Content-Disposition'] = 'attachment';
    return ({ ...outcomeMeta, status: 200, kind: 'file', path: absolute });
}
module.exports = { getTeachingAsset };
