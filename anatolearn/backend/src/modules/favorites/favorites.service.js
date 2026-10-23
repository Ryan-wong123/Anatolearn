const repository = require('./favorites.repository');
const { canRead } = require('../../access');
const FAVORITE_TYPES = ['video', 'quiz', 'model', 'resource'];
async function listFavorites(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const videoFavorites = await repository.listVideos([input.user.id, input.user.program_id]);
    const quizFavorites = await repository.listQuizzes([input.user.id, input.user.program_id]);
    const modelFavorites = await repository.listModels([input.user.id, input.user.program_id]);
    const resourceFavorites = await repository.listResources([input.user.id, input.user.program_id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: {
            videos: videoFavorites.rows,
            quizzes: quizFavorites.rows,
            models: modelFavorites.rows,
            resources: resourceFavorites.rows,
        } });
}
async function addFavorite(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { item_type, item_id } = input.body;
    if (!FAVORITE_TYPES.includes(item_type) || !item_id) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "item_type ('video', 'quiz', 'model' or 'resource') and item_id are required" } });
    }
    try {
        const row = (await repository.findContent([item_id], item_type)).rows[0];
        if (!row || !canRead(input.user, row))
            return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: 'Content unavailable' } });
        const result = await repository.insertFavorite([input.user.id, item_type, item_id]);
        // Already favorited (ON CONFLICT DO NOTHING returned no row) â€” not an
        // error, just nothing new to report.
        return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] || { message: "Already favorited" } });
    }
    catch (err) {
        console.error("Failed to add favorite:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Failed to add favorite" } });
    }
}
async function removeFavorite(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { item_type, item_id } = input.params;
    if (!FAVORITE_TYPES.includes(item_type)) {
        return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "item_type must be 'video', 'quiz', 'model' or 'resource'" } });
    }
    const result = await repository.deleteFavorite([input.user.id, item_type, item_id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] || { message: "Not favorited" } });
}
module.exports = { listFavorites, addFavorite, removeFavorite };
