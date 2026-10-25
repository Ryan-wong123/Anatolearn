// Usage: node scripts/cleanup-orphan-files.js [--delete] [--min-age-hours N]
// Finds stored files (local disk or S3) that no model, video or resource refers to: leftovers from content deleted before files were
// removed with it, and from uploads that failed half way. By default it only REPORTS. Pass --delete to remove them.
// Files newer than --min-age-hours (default 24) are ignored, so an upload in progress is never touched.
const pool = require('../src/db');
const { findOrphans, deleteOrphans } = require('../src/assetCleanup');

const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
(async () => {
  const args = process.argv.slice(2);
  const hoursIndex = args.indexOf('--min-age-hours');
  const minAgeHours = hoursIndex >= 0 ? Number(args[hoursIndex + 1]) : 24;
  if (!Number.isFinite(minAgeHours) || minAgeHours < 0) throw new Error('--min-age-hours must be a number of hours (0 or more)');
  const { scanned, orphans, bytes } = await findOrphans({ minAgeHours });
  console.log(`Scanned ${scanned} stored files; ${orphans.length} are not referenced by any content and older than ${minAgeHours} h (${mb(bytes)}).`);
  for (const file of orphans.slice(0, 50)) console.log(`  ${file.path}  ${mb(file.size)}  ${new Date(file.modified).toISOString().slice(0, 10)}`);
  if (orphans.length > 50) console.log(`  ... and ${orphans.length - 50} more`);
  if (!args.includes('--delete')) { if (orphans.length) console.log('Dry run: nothing deleted. Re-run with --delete to remove these files.'); return; }
  console.log(`Deleted ${await deleteOrphans(orphans)} files.`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
