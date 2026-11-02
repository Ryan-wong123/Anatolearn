const pool = require('../../db');
async function checkDatabase() {
    return pool.query("SELECT NOW()");
}
async function listPrograms() {
    return pool.query("SELECT * FROM programs ORDER BY id");
}
module.exports = { checkDatabase, listPrograms };

const { cachedRead } = require('../../cache');
module.exports.listPrograms = cachedRead('programs', 'publicCatalog.listPrograms', 3600, listPrograms);
