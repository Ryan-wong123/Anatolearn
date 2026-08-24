const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !/(_test|test_)/i.test(databaseUrl)) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated database whose name contains "test".');
}

const sqlDirectory = path.resolve(__dirname, '../sql');
const migrations = [
  '001_schema.sql', '002_seed.sql', '003_add_users.sql',
  '004_add_model_fields_and_downloads.sql',
  '005_add_quiz_attempt_student_id.sql', '006_add_video_annotation_link.sql',
];

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const migration of migrations) {
      await client.query(await fs.readFile(path.join(sqlDirectory, migration), 'utf8'));
    }
    await client.query(await fs.readFile(path.join(__dirname, 'fixtures.sql'), 'utf8'));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
