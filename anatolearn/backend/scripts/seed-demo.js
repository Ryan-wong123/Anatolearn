// Development only: wipes content tables and loads sample rows from seed/demo.sql.
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const pool = require('../src/db');

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to load demo data when NODE_ENV=production');
  await pool.query(await fs.readFile(path.join(__dirname, '../seed/demo.sql'), 'utf8'));
  console.log('Demo data loaded');
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
