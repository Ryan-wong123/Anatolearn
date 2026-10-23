const repository = require('./catalog.repository');
const { canRead } = require('../../access');
async function assignProgram(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    if (!['models', 'videos', 'quizzes', 'resources'].includes(input.params.kind))
        return ({ ...outcomeMeta, status: 404, kind: 'status' });
    const id = input.body.program_id;
    if (id !== null && (!Number.isSafeInteger(id) || id <= 0))
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Invalid program ID' } });
    if (id !== null && !(await repository.findProgram([id])).rows.length)
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'Programme not found' } });
    const result = await repository.updateContentProgram([id, input.params.id], input.params.kind);
    if (!result.rows.length)
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: 'Content not found' } });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function visibleRows(input, rows) {
    const selected = input.headers['x-program-name'];
    let selectedId;
    if (selected)
        selectedId = (await repository.findProgramByName([decodeURIComponent(selected)])).rows[0]?.id;
    return rows.filter((row) => canRead(input.user, row) &&
        (!selected || row.program_id == null || row.program_id === selectedId));
}
// Optional paging for list endpoints: ?page=1&page_size=24. Without page_size every row is returned, so older clients keep working.
function paged(input, rows) {
    const size = Number.parseInt(input.query?.page_size, 10);
    if (!Number.isInteger(size) || size < 1) return { body: rows, headers: { 'X-Total-Count': String(rows.length) } };
    const page = Math.max(1, Number.parseInt(input.query.page, 10) || 1);
    const limit = Math.min(size, 100);
    return { body: rows.slice((page - 1) * limit, page * limit), headers: { 'X-Total-Count': String(rows.length) } };
}
module.exports = { assignProgram, visibleRows, paged };
