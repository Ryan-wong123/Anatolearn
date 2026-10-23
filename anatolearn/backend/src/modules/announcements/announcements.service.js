const repository = require('./announcements.repository');
const meta = () => ({ headers: {}, cookies: [] });
const fail = (status, message) => ({ ...meta(), status, kind: 'json', body: { message } });
async function parse(body) {
    const { title, program_id, expires_at } = body;
    const text = body.body;
    if (typeof title !== 'string' || !title.trim() || title.length > 255) return { error: 'A title (max 255 characters) is required' };
    if (typeof text !== 'string' || !text.trim() || text.length > 5000) return { error: 'A message (max 5000 characters) is required' };
    if (program_id != null && !(Number.isInteger(program_id) && (await repository.findProgram([program_id])).rows[0])) return { error: 'Unknown programme' };
    if (expires_at != null && Number.isNaN(Date.parse(expires_at))) return { error: 'Invalid expiry date' };
    return { values: [title.trim(), text.trim(), program_id ?? null, expires_at ?? null] };
}
async function listAnnouncements(input) {
    const rows = input.user.role === 'teacher' ? (await repository.listAll()).rows : (await repository.listForStudent([input.user.program_id])).rows;
    return { ...meta(), status: 200, kind: 'json', body: rows };
}
async function createAnnouncement(input) {
    const parsed = await parse(input.body);
    if (parsed.error) return fail(400, parsed.error);
    return { ...meta(), status: 201, kind: 'json', body: (await repository.insert([...parsed.values, input.user.id])).rows[0] };
}
async function updateAnnouncement(input) {
    const parsed = await parse(input.body);
    if (parsed.error) return fail(400, parsed.error);
    const row = (await repository.update([input.params.id, ...parsed.values])).rows[0];
    return row ? { ...meta(), status: 200, kind: 'json', body: row } : fail(404, 'Announcement not found');
}
async function deleteAnnouncement(input) {
    const row = (await repository.remove([input.params.id])).rows[0];
    return row ? { ...meta(), status: 200, kind: 'json', body: { message: 'Announcement deleted' } } : fail(404, 'Announcement not found');
}
module.exports = { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
