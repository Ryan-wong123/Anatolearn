const pool = require('../../db');
const { OWNED } = require('../../ownership');

// Table and column names come from the OWNED allowlist, never from a request.
const tables = Object.values(OWNED);
async function find(table, column, published, id) {
    return pool.query(`SELECT id, ${column} AS owner, (${published}) AS published FROM ${table} WHERE id = $1`, [id]);
}
async function claim(table, column, id, userId) {
    return pool.query(`UPDATE ${table} SET ${column} = $2 WHERE id = $1 AND ${column} IS NULL RETURNING id`, [id, userId]);
}
// Moves everything owned by `from` (or by nobody, when from is null) to `to`, in one transaction. Returns row counts per table.
async function transfer(from, to) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const moved = {};
        for (const { table, column } of tables) {
            const result = from === null
                ? await client.query(`UPDATE ${table} SET ${column} = $1 WHERE ${column} IS NULL`, [to])
                : await client.query(`UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`, [to, from]);
            moved[table] = result.rowCount;
        }
        await client.query('COMMIT');
        return moved;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}
async function findUser(id) { return pool.query('SELECT id, name, role, is_active FROM users WHERE id = $1', [id]); }
module.exports = { find, claim, transfer, findUser };
