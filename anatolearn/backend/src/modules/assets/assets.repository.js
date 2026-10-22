const pool = require('../../db');
async function findAssetOwners(parameters) {
    return pool.query(`SELECT program_id, is_published FROM models WHERE file_path = $1 OR thumbnail_path = $1
    UNION ALL SELECT program_id, is_published FROM videos WHERE video_path = $1 OR thumbnail_path = $1 OR captions_path = $1
    UNION ALL SELECT program_id, is_published FROM resources WHERE file_path = $1`, parameters);
}
async function listGltfModels() {
    return pool.query("SELECT * FROM models WHERE file_path ILIKE '%.gltf'");
}
module.exports = { findAssetOwners, listGltfModels };
