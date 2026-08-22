const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function assertSafeTestDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required for backend tests');
  const parsed = new URL(url);
  const database = parsed.pathname.slice(1).toLowerCase();
  if (!database.includes('test') || url === process.env.DATABASE_URL) {
    throw new Error('Refusing to run: TEST_DATABASE_URL must name a separate database containing "test"');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET = 'anatolearn-test-secret-not-for-production';
}

async function migrate(pool) {
  // The guarded database is disposable. Recreate its public schema so the
  // partially additive migrations are repeatable across local and CI runs.
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const sqlDir = path.join(__dirname, '../../sql');
  for (const name of fs.readdirSync(sqlDir).filter((name) => /^00[1-6]_.*\.sql$/.test(name)).sort()) {
    await pool.query(fs.readFileSync(path.join(sqlDir, name), 'utf8'));
  }
}

async function reset(pool) {
  await pool.query('TRUNCATE users, downloads, quiz_attempt_answers, quiz_attempts, quiz_questions, resources, quizzes, videos, annotations, models RESTART IDENTITY CASCADE');
}

module.exports = { assertSafeTestDatabase, migrate, reset, Pool };
