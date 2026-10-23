const repository = require('./search.repository');
const { visibleRows } = require('../catalog/catalog.service');
const MAX_PER_GROUP = 8;
async function search(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const term = String(input.query.q || '').trim().slice(0, 100);
    if (term.length < 2) return { ...outcomeMeta, status: 200, kind: 'json', body: { query: term, models: [], videos: [], quizzes: [], resources: [], annotations: [] } };
    const found = await repository.search(term);
    const body = { query: term };
    for (const [group, rows] of Object.entries(found)) {
        body[group] = (await visibleRows(input, rows)).slice(0, MAX_PER_GROUP).map(({ is_published, program_id, ...rest }) => rest);
    }
    return { ...outcomeMeta, status: 200, kind: 'json', body };
}
module.exports = { search };
