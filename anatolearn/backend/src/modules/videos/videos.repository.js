const pool = require('../../db');
async function listPublished() {
    return pool.query("SELECT * FROM videos WHERE is_published = true ORDER BY id");
}
async function listAll() {
    return pool.query("SELECT * FROM videos ORDER BY id");
}
async function findVideo(parameters) {
    return pool.query("SELECT * FROM videos WHERE id = $1", parameters);
}
async function insertVideo(parameters) {
    return pool.query(`INSERT INTO videos (title, description, video_path, captions_path, program_id, is_published)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING *`, parameters);
}
async function findCaptions(parameters) {
    return pool.query('SELECT captions_path FROM videos WHERE id=$1', parameters);
}
async function updateCaptions(parameters) {
    return pool.query('UPDATE videos SET captions_path=$1 WHERE id=$2 RETURNING *', parameters);
}
async function clearCaptions(parameters) {
    return pool.query('UPDATE videos SET captions_path=NULL WHERE id=$1 RETURNING *', parameters);
}
async function deleteVideo(parameters) {
    return pool.query("DELETE FROM videos WHERE id = $1 RETURNING *", parameters);
}
async function updatePublication(parameters) {
    return pool.query(`UPDATE videos SET is_published = $1 WHERE id = $2 RETURNING *`, parameters);
}
async function updateVideo(parameters) {
    return pool.query(`UPDATE videos SET title = $1, description = $2, annotation_id = $3 WHERE id = $4 RETURNING *`, parameters);
}
module.exports = { listPublished, listAll, findVideo, insertVideo, findCaptions, updateCaptions, clearCaptions, deleteVideo, updatePublication, updateVideo };
