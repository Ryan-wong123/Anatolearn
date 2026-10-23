const fs = require('fs/promises');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../sql');
// Databases created by the old docker-entrypoint flow already contain these. 001 drops every table and
// 002 seeded demo rows, so they must never be replayed against a live database. 003+ are idempotent.
const BASELINE = ['001_schema.sql', '002_seed.sql'];

async function migrate(pool, { log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(71212, 2)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), baseline BOOLEAN NOT NULL DEFAULT false)`);
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    const applied = new Set((await client.query('SELECT filename FROM schema_migrations')).rows.map((row) => row.filename));
    if (applied.size === 0 && (await client.query("SELECT to_regclass('public.programs') AS t")).rows[0].t) {
      for (const name of BASELINE.filter((file) => files.includes(file)))
        await client.query('INSERT INTO schema_migrations(filename, baseline) VALUES ($1, true)', [name]), applied.add(name);
      log('Existing database detected; baselined', BASELINE.join(', '));
    }
    const ran = [];
    for (const name of files.filter((file) => !applied.has(file))) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${name} failed: ${error.message}`);
      }
      ran.push(name);
      log('Applied migration', name);
    }
    return ran;
  } finally {
    await client.query('SELECT pg_advisory_unlock(71212, 2)').catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  require('dotenv').config();
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL });
  migrate(pool).then((ran) => console.log(ran.length ? `Applied ${ran.length} migration(s)` : 'Database is up to date'))
    .catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
}
module.exports = { migrate };
