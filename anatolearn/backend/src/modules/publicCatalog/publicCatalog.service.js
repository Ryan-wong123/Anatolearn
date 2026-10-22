const repository = require('./publicCatalog.repository');
async function health(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const result = await repository.checkDatabase();
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: { status: "ok", db_time: result.rows[0].now } });
    }
    catch (err) {
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { status: "error", message: err.message } });
    }
}
async function listPrograms(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listPrograms();
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
module.exports = { health, listPrograms };
