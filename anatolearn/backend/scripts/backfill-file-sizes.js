// Usage: node scripts/backfill-file-sizes.js
// Fills in models.file_size, videos.file_size and resources.file_size for content uploaded before sizes were recorded, by
// measuring the stored files (local disk or S3). Safe to run repeatedly: it only touches rows still at 0, and it leaves a row at
// 0 if its file cannot be found. Needed once after upgrading so storage limits count existing content.
const pool = require('../src/db');
const storage = require('../src/storage');

async function fill(table, columns, where = 'TRUE') {
  const rows = (await pool.query(`SELECT id, ${columns.join(', ')} FROM ${table} WHERE file_size = 0 AND ${where}`)).rows;
  let updated = 0, missing = 0;
  for (const row of rows) {
    let total = 0, found = false;
    for (const column of columns) {
      if (!row[column]) continue;
      const size = await storage.statAsset(row[column]);
      if (size === null) continue;
      total += size; found = true;
    }
    if (!found) { missing += 1; continue; }
    await pool.query(`UPDATE ${table} SET file_size = $1 WHERE id = $2`, [total, row.id]);
    updated += 1;
  }
  console.log(`${table}: ${updated} updated${missing ? `, ${missing} with no file found (left at 0)` : ''}`);
}

(async () => {
  await fill('models', ['file_path']);
  await fill('videos', ['video_path', 'captions_path']);
  await fill('resources', ['file_path'], "resource_type <> 'link'");
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
