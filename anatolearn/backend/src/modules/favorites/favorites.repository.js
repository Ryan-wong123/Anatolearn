const pool = require('../../db');
async function listVideos(parameters) {
    return pool.query(`SELECT f.id AS favorite_id, f.item_type, f.created_at,
            v.id, v.title, v.description, v.thumbnail_path, v.is_published
     FROM favorites f
     JOIN videos v ON v.id = f.item_id
     WHERE f.user_id = $1 AND f.item_type = 'video' AND v.is_published AND (v.program_id IS NULL OR v.program_id = $2)
     ORDER BY f.created_at DESC`, parameters);
}
async function listQuizzes(parameters) {
    return pool.query(`SELECT f.id AS favorite_id, f.item_type, f.created_at,
            q.id, q.title, q.description, q.type, q.category, q.is_published
     FROM favorites f
     JOIN quizzes q ON q.id = f.item_id
     WHERE f.user_id = $1 AND f.item_type = 'quiz' AND q.is_published AND (q.program_id IS NULL OR q.program_id = $2)
     ORDER BY f.created_at DESC`, parameters);
}
async function findContent(parameters, itemType) {
    const table = { video: 'videos', quiz: 'quizzes' }[itemType];
    if (!table) throw new Error('Unsupported favourite type');
    return pool.query(`SELECT * FROM ${table} WHERE id=$1`, parameters);
}
async function insertFavorite(parameters) {
    return pool.query(`INSERT INTO favorites (user_id, item_type, item_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_type, item_id) DO NOTHING
       RETURNING *`, parameters);
}
async function deleteFavorite(parameters) {
    return pool.query(`DELETE FROM favorites WHERE user_id = $1 AND item_type = $2 AND item_id = $3 RETURNING *`, parameters);
}
module.exports = { listVideos, listQuizzes, findContent, insertFavorite, deleteFavorite };
