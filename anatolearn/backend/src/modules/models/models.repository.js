const pool = require('../../db');
async function updateDownloadPermission(parameters) {
    return pool.query('UPDATE models SET is_downloadable=$1 WHERE id=$2 RETURNING *', parameters);
}
async function listModels({ published, system, part, q }, publishedOnly) {
    const conditions = [];
    const parameters = [];
    if (published === 'true' || publishedOnly) conditions.push('is_published = true');
    if (system) {
        parameters.push(system);
        conditions.push(`body_system = $${parameters.length}`);
    }
    if (part) {
        parameters.push(part);
        conditions.push(`body_part = $${parameters.length}`);
    }
    if (q) {
        parameters.push(`%${q}%`);
        conditions.push(`(title ILIKE $${parameters.length} OR description ILIKE $${parameters.length} OR body_system ILIKE $${parameters.length} OR body_part ILIKE $${parameters.length})`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return pool.query(`SELECT * FROM models ${whereClause} ORDER BY id`, parameters);
}
async function findModel(parameters) {
    return pool.query("SELECT * FROM models WHERE id = $1", parameters);
}
async function insertModel(parameters) {
    return pool.query(`INSERT INTO models (title, description, file_path, program_id, body_system, body_part, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`, parameters);
}
async function deleteModel(parameters) {
    return pool.query("DELETE FROM models WHERE id = $1 RETURNING *", parameters);
}
async function updatePublication(parameters) {
    return pool.query(`UPDATE models SET is_published = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`, parameters);
}
async function updateNeutralView(parameters) {
    return pool.query(`UPDATE models
         SET neutral_view = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`, parameters);
}
async function updateModel(parameters) {
    return pool.query(`UPDATE models SET title = $1, description = $2, body_system = $3, body_part = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`, parameters);
}
async function logDownload(parameters) {
    return pool.query("INSERT INTO downloads (model_id, downloaded_by) VALUES ($1, $2)", parameters);
}
async function updateThumbnail(parameters) {
    return pool.query(`UPDATE models
       SET thumbnail_path = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, parameters);
}
module.exports = { updateDownloadPermission, listModels, findModel, insertModel, deleteModel, updatePublication, updateNeutralView, updateModel, logDownload, updateThumbnail };
