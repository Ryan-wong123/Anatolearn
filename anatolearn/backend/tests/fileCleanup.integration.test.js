const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
const storage = require('../src/storage');
const cleanup = require('../src/assetCleanup');
process.env.DISABLE_RATE_LIMIT = 'true';

const onDisk = (assetPath) => fs.access(path.join(storage.ROOT, '.' + assetPath)).then(() => true, () => false);

test('deleting content removes its stored files, and orphan cleanup finds what is left', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `clean-${Date.now()}`;
  const userIds = [], modelIds = [], videoIds = [], resourceIds = [], extra = [];
  try {
    const email = `${stamp}@example.test`;
    userIds.push((await pool.query("INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,'teacher',1) RETURNING id", [stamp, email, await bcrypt.hash('Maple9Window', 4)])).rows[0].id);
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Maple9Window' }) });
    assert.equal(login.status, 200);
    const token = decodeURIComponent(login.headers.getSetCookie().find((c) => c.startsWith('anatolearn_session=')).split(';')[0].split('=').slice(1).join('='));
    const auth = { Authorization: `Bearer ${token}` };
    const upload = async (route, form) => (await fetch(base + route, { method: 'POST', headers: auth, body: form })).json();
    const del = (route) => fetch(base + route, { method: 'DELETE', headers: auth });

    const modelForm = new FormData(); modelForm.append('title', `${stamp} model`); modelForm.append('program_id', '1');
    modelForm.append('model', new Blob(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n']), 'a.obj');
    const model = await upload('/api/models/upload', modelForm); modelIds.push(model.id);
    const videoForm = new FormData(); videoForm.append('title', `${stamp} video`); videoForm.append('program_id', '1');
    videoForm.append('video', new Blob([Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)])]), 'a.mp4');
    const video = await upload('/api/videos/upload', videoForm); videoIds.push(video.id);

    await t.test('deleting a model and a video removes their files', async () => {
      assert.equal(await onDisk(model.file_path), true);
      assert.equal(await onDisk(video.video_path), true);
      assert.equal((await del(`/api/models/${model.id}`)).status, 200);
      assert.equal((await del(`/api/videos/${video.id}`)).status, 200);
      assert.equal(await onDisk(model.file_path), false);
      assert.equal(await onDisk(video.video_path), false);
    });

    await t.test('a file another row still uses is kept, and paths outside the upload folders are never touched', async () => {
      const shared = `/models/${stamp}-shared.obj`;
      await storage.writeAsset(shared, Buffer.from('v 0 0 0\n')); extra.push(shared);
      const a = (await pool.query("INSERT INTO models(title,file_path,program_id) VALUES($1,$2,1) RETURNING id", [`${stamp} a`, shared])).rows[0].id;
      const b = (await pool.query("INSERT INTO models(title,file_path,program_id) VALUES($1,$2,1) RETURNING id", [`${stamp} b`, shared])).rows[0].id;
      modelIds.push(a, b);
      assert.equal((await del(`/api/models/${a}`)).status, 200);
      assert.equal(await onDisk(shared), true, 'still used by the other model');
      assert.equal((await del(`/api/models/${b}`)).status, 200);
      assert.equal(await onDisk(shared), false);
      assert.deepEqual(await cleanup.removeFiles(['/etc/passwd', '/models/../package.json', '/other/x', null, 'https://example.com/x.obj']), []);
    });

    await t.test('deleting a link resource touches no file', async () => {
      const resource = (await pool.query("INSERT INTO resources(title,resource_type,file_path,program_id) VALUES($1,'link','https://example.com/x',1) RETURNING id", [`${stamp} link`])).rows[0].id;
      resourceIds.push(resource);
      assert.equal((await del(`/api/resources/${resource}`)).status, 200);
    });

    await t.test('orphan finder skips referenced and recent files, and the delete step removes the rest', async () => {
      const orphan = `/models/${stamp}-orphan.obj`, referencedPath = `/models/${stamp}-kept.obj`;
      await storage.writeAsset(orphan, Buffer.from('v 0 0 0\n')); await storage.writeAsset(referencedPath, Buffer.from('v 0 0 0\n')); extra.push(orphan, referencedPath);
      modelIds.push((await pool.query("INSERT INTO models(title,file_path,program_id) VALUES($1,$2,1) RETURNING id", [`${stamp} kept`, referencedPath])).rows[0].id);
      const fresh = await cleanup.findOrphans({ minAgeHours: 24 });
      assert.ok(!fresh.orphans.some((file) => file.path === orphan), 'recent files are not orphans yet');
      const later = await cleanup.findOrphans({ minAgeHours: 24, now: Date.now() + 48 * 3600 * 1000 });
      assert.ok(later.orphans.some((file) => file.path === orphan));
      assert.ok(!later.orphans.some((file) => file.path === referencedPath));
      await cleanup.deleteOrphans(later.orphans.filter((file) => file.path === orphan));
      assert.equal(await onDisk(orphan), false);
      assert.equal(await onDisk(referencedPath), true);
    });
  } finally {
    server.close();
    await pool.query('DELETE FROM models WHERE id = ANY($1)', [modelIds]);
    await pool.query('DELETE FROM videos WHERE id = ANY($1)', [videoIds]);
    await pool.query('DELETE FROM resources WHERE id = ANY($1)', [resourceIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    for (const file of extra) await storage.removeAsset(file).catch(() => {});
    await pool.end();
  }
});
