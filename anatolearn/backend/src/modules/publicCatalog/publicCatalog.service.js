const repository = require('./publicCatalog.repository');
async function health(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        await repository.checkDatabase();
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: { status: "ok" } });
    }
    catch (err) {
        console.error('Health check failed:', err.message);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { status: "error" } });
    }
}
async function listPrograms(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listPrograms();
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
module.exports = { health, listPrograms };
