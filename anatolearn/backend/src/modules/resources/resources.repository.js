const pool = require('../../db');
async function listPublished() {
    return pool.query("SELECT * FROM resources WHERE is_published = true ORDER BY id");
}
async function listAll() {
    return pool.query("SELECT * FROM resources ORDER BY id");
}
async function insertResource(parameters) {
    return pool.query(`INSERT INTO resources (title, description, resource_type, file_path, program_id, is_published, owner_id, file_size)
   VALUES ($1, $2, $3, $4, $5, false, $6, $7)
   RETURNING *`, parameters);
}
async function deleteResource(parameters) {
    return pool.query("DELETE FROM resources WHERE id = $1 RETURNING *", parameters);
}
async function findResource(parameters) {
    return pool.query("SELECT * FROM resources WHERE id = $1", parameters);
}
async function updateResource(parameters) {
    return pool.query(`UPDATE resources SET title = $1, description = $2, file_path = $3 WHERE id = $4 RETURNING *`, parameters);
}
async function updatePublication(parameters) {
    return pool.query(`UPDATE resources SET is_published = $1 WHERE id = $2 RETURNING *`, parameters);
}
module.exports = { listPublished, listAll, insertResource, deleteResource, findResource, updateResource, updatePublication };

const { cachedRead } = require('../../cache');
module.exports.listPublished = cachedRead('catalog', 'resources.listPublished', 300, listPublished);
module.exports.listAll = cachedRead('catalog', 'resources.listAll', 300, listAll);
