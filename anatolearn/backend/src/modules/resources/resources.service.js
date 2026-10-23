const repository = require('./resources.repository');
const fs = require('fs/promises');
const storage = require('../../storage');
const { visibleRows, paged } = require('../catalog/catalog.service');
async function listResources(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { published } = input.query;
    if (published === "true" || input.user.role === "student") {
        const result = await repository.listPublished();
        return ({ ...outcomeMeta, status: 200, kind: 'json', ...paged(input, await visibleRows(input, result.rows)) });
    }
    const result = await repository.listAll();
    return ({ ...outcomeMeta, status: 200, kind: 'json', ...paged(input, await visibleRows(input, result.rows)) });
}
async function uploadResource(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const { title, description, resource_type, url, program_id } = input.body;
        if (!title) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title is required" } });
        }
        if (!resource_type || !["pdf", "document", "link", "image"].includes(resource_type)) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "resource_type must be pdf, document, image, or link" } });
        }
        let filePath;
        if (resource_type === "link") {
            if (!url) {
                return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "url is required for link resources" } });
            }
            try {
                if (!['http:', 'https:'].includes(new URL(url).protocol))
                    throw new Error();
            }
            catch {
                return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Use an HTTP or HTTPS reference URL' } });
            }
            filePath = url;
        }
        else {
            if (!input.file) {
                return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "file is required for pdf/document resources" } });
            }
            try {
                await storage.validateResource(input.file, resource_type);
            }
            catch (error) {
                await fs.unlink(input.file.path).catch(() => { });
                return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: error.message } });
            }
            filePath = await storage.persist(input.file, 'resources');
        }
        const result = await repository.insertResource([title, description || null, resource_type, filePath, program_id || null]);
        return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to upload resource:", err);
        return ({ ...outcomeMeta, status: err.status || 500, kind: 'json', body: { message: err.status && err.status < 500 ? err.message : "Failed to upload resource" } });
    }
}
async function deleteResource(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.deleteResource([input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Resource not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: "Resource deleted" } });
}
async function updateResource(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { title, description, url } = input.body;
    if (!title || !title.trim()) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "title is required" } });
    }
    try {
        const existing = await repository.findResource([input.params.id]);
        if (existing.rows.length === 0) {
            return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Resource not found" } });
        }
        const resource = existing.rows[0];
        // Only link-type resources can have their URL edited here â€” pdf/document
        // resources are tied to an uploaded file and would need a re-upload flow,
        // which is out of scope for this edit action.
        let filePath = resource.file_path;
        if (resource.resource_type === "link") {
            if (!url || !url.trim()) {
                return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "url is required for link resources" } });
            }
            try {
                if (!['http:', 'https:'].includes(new URL(url).protocol))
                    throw new Error();
            }
            catch {
                return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Use an HTTP or HTTPS reference URL' } });
            }
            filePath = url;
        }
        const result = await repository.updateResource([title, description || null, filePath, input.params.id]);
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to update resource:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Failed to update resource" } });
    }
}
async function setPublication(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { is_published } = input.body;
    const result = await repository.updatePublication([is_published, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Resource not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
module.exports = { listResources, uploadResource, deleteResource, updateResource, setPublication };
