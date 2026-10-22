const repository = require('./videos.repository');
const fs = require('fs/promises');
const storage = require('../../storage');
const { visibleRows } = require('../catalog/catalog.service');
async function listVideos(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { published } = input.query;
    if (published === "true" || input.user.role === "student") {
        const result = await repository.listPublished();
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: await visibleRows(input, result.rows) });
    }
    const result = await repository.listAll();
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: await visibleRows(input, result.rows) });
}
async function getVideo(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.findVideo([
        input.params.id,
    ]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Video not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function uploadVideo(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const videoFile = input.files?.video?.[0];
        const captionFile = input.files?.captions?.[0];
        if (!videoFile) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "No video file uploaded" } });
        }
        const { title, description, program_id } = input.body;
        if (!title) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title is required" } });
        }
        if (captionFile)
            await storage.validateCaptions(captionFile);
        const videoPath = `/videos/${videoFile.filename}`;
        const captionsPath = captionFile ? `/captions/${captionFile.filename}` : null;
        const result = await repository.insertVideo([title, description || null, videoPath, captionsPath, program_id || null]);
        return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to upload video:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: err.message || "Failed to upload video" } });
    }
}
async function replaceCaptions(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const captionFile = input.files?.captions?.[0];
    if (!captionFile || input.files?.video?.length)
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Upload exactly one .vtt caption file' } });
    await storage.validateCaptions(captionFile);
    const existing = (await repository.findCaptions([input.params.id])).rows[0];
    if (!existing)
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: 'Video not found' } });
    const nextPath = `/captions/${captionFile.filename}`;
    const result = await repository.updateCaptions([nextPath, input.params.id]);
    if (existing.captions_path && existing.captions_path !== nextPath)
        await fs.unlink(storage.resolveAsset(existing.captions_path)).catch(() => { });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function removeCaptions(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const existing = (await repository.findCaptions([input.params.id])).rows[0];
    if (!existing)
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: 'Video not found' } });
    const result = await repository.clearCaptions([input.params.id]);
    if (existing.captions_path)
        await fs.unlink(storage.resolveAsset(existing.captions_path)).catch(() => { });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function deleteVideo(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.deleteVideo([input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Video not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: "Video deleted" } });
}
async function setPublication(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { is_published } = input.body;
    const result = await repository.updatePublication([is_published, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Video not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function updateVideo(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { title, description, annotation_id } = input.body;
    if (!title) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title is required" } });
    }
    const result = await repository.updateVideo([title, description || null, annotation_id || null, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Video not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
module.exports = { listVideos, getVideo, uploadVideo, replaceCaptions, removeCaptions, deleteVideo, setPublication, updateVideo };
