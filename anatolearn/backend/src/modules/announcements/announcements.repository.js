const pool = require('../../db');
async function listForStudent(parameters) {
    return pool.query(`SELECT a.id, a.title, a.body, a.program_id, a.created_at, a.expires_at, u.name AS author FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE (a.expires_at IS NULL OR a.expires_at > NOW()) AND (a.program_id IS NULL OR a.program_id = $1)
      ORDER BY a.created_at DESC LIMIT 50`, parameters);
}
async function listAll() {
    return pool.query(`SELECT a.id, a.title, a.body, a.program_id, a.created_at, a.expires_at, u.name AS author FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC LIMIT 200`);
}
async function insert(parameters) {
    return pool.query('INSERT INTO announcements(title, body, program_id, expires_at, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *', parameters);
}
async function update(parameters) {
    return pool.query('UPDATE announcements SET title=$2, body=$3, program_id=$4, expires_at=$5 WHERE id=$1 RETURNING *', parameters);
}
async function remove(parameters) { return pool.query('DELETE FROM announcements WHERE id = $1 RETURNING id', parameters); }
async function findProgram(parameters) { return pool.query('SELECT id FROM programs WHERE id = $1', parameters); }
module.exports = { listForStudent, listAll, insert, update, remove, findProgram };
