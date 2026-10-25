// Removing stored files when the content that owns them is deleted, and finding files that nothing owns any more.
const pool = require('./db');
const storage = require('./storage');

// Only these folders hold uploads. A path anywhere else (a bad or hand-edited database value) is never deleted.
const UPLOAD_FOLDERS = ['models', 'videos', 'captions', 'resources', 'thumbnails'];
const isUploadPath = (value) => typeof value === 'string' && UPLOAD_FOLDERS.some((folder) => value.startsWith(`/${folder}/`)) && !value.split('/').includes('..');

// Which of these stored paths does some row still use? (Demo and legacy rows can share one file.)
async function stillReferenced(paths) {
  const { rows } = await pool.query(`
    SELECT file_path AS path FROM models WHERE file_path = ANY($1)
    UNION SELECT thumbnail_path FROM models WHERE thumbnail_path = ANY($1)
    UNION SELECT video_path FROM videos WHERE video_path = ANY($1)
    UNION SELECT captions_path FROM videos WHERE captions_path = ANY($1)
    UNION SELECT thumbnail_path FROM videos WHERE thumbnail_path = ANY($1)
    UNION SELECT file_path FROM resources WHERE file_path = ANY($1) AND resource_type <> 'link'`, [paths]);
  return new Set(rows.map((row) => row.path));
}

// Deletes the stored files of a row that was just deleted, except any another row still uses. Best effort: a file that cannot be
// removed is logged and left for the orphan cleanup, and never makes the deletion itself fail. Returns the paths removed.
async function removeFiles(paths) {
  const candidates = [...new Set(paths.filter(isUploadPath))];   // links store URLs, which are not files
  if (!candidates.length) return [];
  try {
    const shared = await stillReferenced(candidates);
    const removable = candidates.filter((candidate) => !shared.has(candidate));
    for (const candidate of removable) await storage.removeAsset(candidate);
    return removable;
  } catch (error) {
    console.error('Could not remove stored files after a deletion:', error.message);
    return [];
  }
}

// Files an external-texture glTF model depends on (legacy uploads): they are in use even though no column names them.
async function gltfDependencies() {
  const used = new Set();
  const { rows } = await pool.query("SELECT file_path FROM models WHERE file_path ILIKE '%.gltf'");
  for (const { file_path: modelPath } of rows) {
    try {
      const document = JSON.parse((await storage.readAsset(modelPath)).toString('utf8'));
      for (const item of [...(document.buffers || []), ...(document.images || [])])
        if (item.uri && !/^(data:|https?:|\/)/i.test(item.uri)) used.add(require('path').posix.normalize(require('path').posix.join(require('path').posix.dirname(modelPath), decodeURIComponent(item.uri))));
    } catch { /* an unreadable model keeps whatever it references out of the orphan list only if named elsewhere */ }
  }
  return used;
}

// Stored files that no row refers to. Files younger than minAgeHours are skipped, because an upload in progress looks like an orphan.
async function findOrphans({ minAgeHours = 24, now = Date.now() } = {}) {
  const referenced = new Set((await pool.query(`
    SELECT file_path AS p FROM models UNION SELECT thumbnail_path FROM models
    UNION SELECT video_path FROM videos UNION SELECT captions_path FROM videos UNION SELECT thumbnail_path FROM videos
    UNION SELECT file_path FROM resources WHERE resource_type <> 'link'`)).rows.map((row) => row.p).filter(Boolean));
  for (const dependency of await gltfDependencies()) referenced.add(dependency);
  const orphans = [];
  let scanned = 0;
  for (const folder of UPLOAD_FOLDERS) {
    for (const file of await storage.listAssets(folder)) {
      scanned += 1;
      if (!referenced.has(file.path) && now - file.modified >= minAgeHours * 3600 * 1000) orphans.push(file);
    }
  }
  return { scanned, orphans, bytes: orphans.reduce((sum, file) => sum + file.size, 0) };
}

async function deleteOrphans(orphans) {
  for (const file of orphans) await storage.removeAsset(file.path);
  return orphans.length;
}

module.exports = { removeFiles, findOrphans, deleteOrphans, isUploadPath, UPLOAD_FOLDERS };
