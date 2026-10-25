const pool = require('../../db');
const LIMIT = 30;
async function search(term) {
    const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    const [models, videos, quizzes, resources, annotations] = await Promise.all([
        pool.query(`SELECT id, title, description, body_system, body_part, program_id, is_published, owner_id FROM models
          WHERE title ILIKE $1 OR description ILIKE $1 OR body_system ILIKE $1 OR body_part ILIKE $1 ORDER BY title LIMIT ${LIMIT}`, [like]),
        pool.query(`SELECT id, title, description, program_id, is_published, owner_id FROM videos WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY title LIMIT ${LIMIT}`, [like]),
        pool.query(`SELECT id, title, description, category, program_id, is_published, owner_id FROM quizzes WHERE title ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 ORDER BY title LIMIT ${LIMIT}`, [like]),
        pool.query(`SELECT id, title, description, resource_type, program_id, is_published, owner_id FROM resources WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY title LIMIT ${LIMIT}`, [like]),
        pool.query(`SELECT a.id, a.label AS title, a.description, m.id AS model_id, m.title AS model_title, m.program_id, m.is_published, m.owner_id
          FROM annotations a JOIN models m ON m.id = a.model_id WHERE a.label ILIKE $1 OR a.description ILIKE $1 ORDER BY a.label LIMIT ${LIMIT}`, [like]),
    ]);
    return { models: models.rows, videos: videos.rows, quizzes: quizzes.rows, resources: resources.rows, annotations: annotations.rows };
}
module.exports = { search };
