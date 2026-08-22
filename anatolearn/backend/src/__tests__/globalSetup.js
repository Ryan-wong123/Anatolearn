const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

function safeTestUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required for backend tests');
  const url = new URL(value);
  if (!/(^|[_-])test($|[_-])|_test$/i.test(url.pathname.slice(1))) {
    throw new Error('Refusing to run: TEST_DATABASE_URL database name must contain "test"');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value && process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run tests against a production database');
  }
  return value;
}

module.exports = async function globalSetup() {
  const databaseUrl = safeTestUrl();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query('DROP TABLE IF EXISTS downloads, users CASCADE; DROP TYPE IF EXISTS user_role, quiz_type CASCADE;');
  for (const name of ['001_schema.sql', '002_seed.sql', '003_add_users.sql', '004_add_model_fields_and_downloads.sql', '005_add_quiz_attempt_student_id.sql', '006_add_video_annotation_link.sql']) {
    await client.query(await fs.readFile(path.join(__dirname, '../../sql', name), 'utf8'));
  }
  await client.end();
}
