const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error('TEST_DATABASE_URL is required');
  const parsed = new URL(connectionString);
  if (!/(^|[_-])test($|[_-])/.test(parsed.pathname.slice(1).toLowerCase())) {
    throw new Error('Refusing to migrate a database whose name has no standalone test segment');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (let index = 1; index <= 6; index += 1) {
      const prefix = String(index).padStart(3, '0');
      const filename = fs.readdirSync(path.join(__dirname, '../sql')).find((name) => name.startsWith(prefix));
      if (!filename) throw new Error(`Missing migration ${prefix}`);
      await client.query(fs.readFileSync(path.join(__dirname, '../sql', filename), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

