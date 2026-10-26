const repository = require('./models.repository');
const fs = require('fs/promises');
const path = require('path');
const { canDownload } = require('../../access');
const storage = require('../../storage');
const quota = require('../../quota');
const { assertImageSize } = require('../../imageSize');
const { removeFiles } = require('../../assetCleanup');
const { visibleRows, paged } = require('../catalog/catalog.service');
async function setDownloadPermission(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    if (typeof input.body.is_downloadable !== 'boolean')
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'is_downloadable must be boolean' } });
    const result = await repository.updateDownloadPermission([input.body.is_downloadable, input.params.id]);
    if (!result.rows.length)
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: 'Model not found' } });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function listModels(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listModels(input.query, input.user.role === 'student');
    return ({ ...outcomeMeta, status: 200, kind: 'json', ...paged(input, await visibleRows(input, result.rows)) });
}
async function getModel(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.findModel([
        input.params.id,
    ]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Model not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function uploadModel(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        if (!input.file) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "No model file uploaded" } });
        }
        try {
            await storage.validateModel(input.file);
        }
        catch (error) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename -- multer's own temp file, named by randomUUID()
            await fs.unlink(input.file.path).catch(() => { });
            throw error;
        }
        const { title, description, program_id, body_system, body_part } = input.body;
        if (!title) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title is required" } });
        }
        await quota.assertWithin(input.user.id, input.file.size);
        const filePath = await storage.persist(input.file, 'models/anatomy');
        const result = await repository.insertModel([title, description || null, filePath, program_id || null, body_system || null, body_part || null, input.user.id, input.file.size]);
        return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to upload model:", err);
        return ({ ...outcomeMeta, status: err.status || 500, kind: 'json', body: { message: err.status && err.status < 500 ? err.message : "Failed to upload model" } });
    }
}
async function deleteModel(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.deleteModel([input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Model not found" } });
    }
    // The row is gone; now free the storage it used, so deleting content really releases space (and quota).
    await removeFiles([result.rows[0].file_path, result.rows[0].thumbnail_path]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: "Model deleted" } });
}
async function setPublication(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { is_published } = input.body;
    const result = await repository.updatePublication([is_published, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Model not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function saveNeutralView(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const { cameraPosition, target } = input.body;
        const isValidPoint = (point) => point &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            Number.isFinite(point.z);
        if (!isValidPoint(cameraPosition) ||
            !isValidPoint(target)) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: {
                    message: "cameraPosition and target must contain valid x, y, and z values",
                } });
        }
        const neutralView = {
            cameraPosition,
            target,
        };
        const result = await repository.updateNeutralView([
            JSON.stringify(neutralView),
            input.params.id,
        ]);
        if (result.rows.length === 0) {
            return ({ ...outcomeMeta, status: 404, kind: 'json', body: {
                    message: "Model not found",
                } });
        }
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to save neutral view:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: {
                message: "Failed to save neutral view",
            } });
    }
}
async function updateModel(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { title, description, body_system, body_part } = input.body;
    if (!title) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title is required" } });
    }
    const result = await repository.updateModel([title, description || null, body_system || null, body_part || null, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Model not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function downloadModel(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const result = await repository.findModel([input.params.id]);
        if (result.rows.length === 0) {
            return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Model not found" } });
        }
        const model = result.rows[0];
        // Teachers can download any model; students only published ones.
        if (!canDownload(input.user, model)) {
            return ({ ...outcomeMeta, status: 403, kind: 'json', body: { message: "This model is not available for download" } });
        }
        const ext = path.extname(model.file_path);
        const safeTitle = model.title.replace(/[^a-z0-9_-]+/gi, "_");
        const downloadName = `${safeTitle}${ext}`;
        // Best-effort logging â€” a failed insert shouldn't block the actual download.
        try {
            await repository.logDownload([model.id, input.user.id]);
        }
        catch (logErr) {
            console.error("Failed to log download (continuing anyway):", logErr);
        }
        if (storage.REMOTE)
            return ({ ...outcomeMeta, status: 200, kind: 'object', assetPath: model.file_path, filename: downloadName });
        return ({ ...outcomeMeta, status: 200, kind: 'download', path: storage.resolveAsset(model.file_path), filename: downloadName });
    }
    catch (err) {
        console.error("Failed to process download:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: err.status && err.status < 500 ? err.message : "Failed to download model" } });
    }
}
async function saveThumbnail(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const { thumbnailDataUrl } = input.body;
        if (!thumbnailDataUrl) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "Missing thumbnail data" } });
        }
        if (typeof thumbnailDataUrl !== 'string' || !/^\d+$/.test(input.params.id))
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "Invalid thumbnail request" } });
        const base64Data = thumbnailDataUrl.replace(/^data:image\/png;base64,/, "");
        const png = Buffer.from(base64Data, "base64");
        if (png.length > 2 * 1024 * 1024 || !png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "Thumbnail must be a PNG image of 2 MiB or smaller" } });
        try { assertImageSize(png, 'The thumbnail'); } catch (error) { return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: error.message } }); }
        const filename = `model-${input.params.id}.png`;
        const publicPath = `/thumbnails/${filename}`;
        await storage.writeAsset(publicPath, png);
        const result = await repository.updateThumbnail([publicPath, input.params.id]);
        if (result.rows.length === 0) {
            return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Model not found" } });
        }
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to save thumbnail:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Failed to save thumbnail" } });
    }
}
module.exports = { setDownloadPermission, listModels, getModel, uploadModel, deleteModel, setPublication, saveNeutralView, updateModel, downloadModel, saveThumbnail };
