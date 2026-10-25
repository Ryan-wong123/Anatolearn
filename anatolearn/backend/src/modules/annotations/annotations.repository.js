const pool = require('../../db');
async function listForModel(parameters) {
    return pool.query("SELECT * FROM annotations WHERE model_id = $1 ORDER BY id", parameters);
}
async function listForExport(parameters) {
    return pool.query(`SELECT id, annotation_type, label, description, color, annotation_data, created_at
       FROM annotations WHERE model_id = $1 ORDER BY id`, parameters);
}
async function insertAnnotation(parameters) {
    return pool.query(`INSERT INTO annotations
      (model_id, annotation_type, label, description, color, annotation_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`, parameters);
}
async function deleteAnnotation(parameters) {
    return pool.query("DELETE FROM annotations WHERE id = $1 RETURNING *", parameters);
}
async function updateAnnotation(parameters) {
    return pool.query(`UPDATE annotations
     SET annotation_type = $1,
         label = $2,
         description = $3,
         color = $4,
         annotation_data = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING *`, parameters);
}
// parameters: [teacherId]. Annotations of other teachers' unpublished models are not listed.
async function listWithModelTitles(parameters) {
    return pool.query(`SELECT a.id, a.label, a.annotation_type, m.title AS model_title
     FROM annotations a
     JOIN models m ON m.id = a.model_id
     WHERE m.is_published OR m.owner_id IS NULL OR m.owner_id = $1
     ORDER BY m.title, a.label`, parameters);
}
module.exports = { listForModel, listForExport, insertAnnotation, deleteAnnotation, updateAnnotation, listWithModelTitles };
