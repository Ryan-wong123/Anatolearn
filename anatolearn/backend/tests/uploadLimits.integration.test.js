const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
const storage = require('../src/storage');
const quota = require('../src/quota');
const { buildZip, docx } = require('./helpers/zip');
process.env.DISABLE_RATE_LIMIT = 'true';

const MB = 1024 * 1024;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9x8AAAAASUVORK5CYII=', 'base64');

test('quota arithmetic and configuration', () => {
  assert.deepEqual(quota.limits({}), { perUser: 5120 * MB, total: 51200 * MB });
  assert.deepEqual(quota.limits({ UPLOAD_QUOTA_MB_PER_USER: '2', UPLOAD_QUOTA_MB_TOTAL: '10' }), { perUser: 2 * MB, total: 10 * MB });
  assert.deepEqual(quota.limits({ UPLOAD_QUOTA_MB_PER_USER: '0', UPLOAD_QUOTA_MB_TOTAL: '0' }), { perUser: 0, total: 0 }, '0 means unlimited');
  assert.equal(quota.limits({ UPLOAD_QUOTA_MB_PER_USER: '0.5' }).perUser, 0.5 * MB);
  for (const bad of ['-1', 'abc', '', undefined]) assert.equal(quota.limits({ UPLOAD_QUOTA_MB_PER_USER: bad }).perUser, 5120 * MB, String(bad));
  const limits = { perUser: 100, total: 1000 };
  assert.equal(quota.problem({ mine: 50, total: 500 }, 50, limits), null, 'exactly at the limit is allowed');
  assert.match(quota.problem({ mine: 50, total: 500 }, 51, limits), /over your storage limit/);
  assert.match(quota.problem({ mine: 0, total: 990 }, 11, limits), /run out of storage/);
  assert.match(quota.problem({ mine: 99, total: 990 }, 11, limits), /run out of storage/, 'the site limit is reported first');
  assert.equal(quota.problem({ mine: 1e12, total: 1e12 }, 1e9, { perUser: 0, total: 0 }), null);
});

test('storage quotas and archive limits on uploads', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `lim-${Date.now()}`;
  const userIds = [], resourceIds = [], modelIds = [], videoIds = [], files = [];
  const saved = { user: process.env.UPLOAD_QUOTA_MB_PER_USER, total: process.env.UPLOAD_QUOTA_MB_TOTAL };
  async function teacher(label, role = 'teacher') {
    const email = `${stamp}-${label}@example.test`;
    const id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id', [`${stamp} ${label}`, email, await bcrypt.hash('Maple9Window', 4), role])).rows[0].id;
    userIds.push(id);
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Maple9Window' }) });
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith('anatolearn_session=')).split(';')[0];
    return { id, token: decodeURIComponent(cookie.split('=').slice(1).join('=')) };
  }
  const upload = async (user, path, field, bytes, name, extra = {}) => {
    const form = new FormData(); form.append('title', `${stamp} ${name}`); for (const [key, value] of Object.entries(extra)) form.append(key, value);
    form.append(field, new Blob([bytes]), name);
    let response;
    try { response = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${user.token}` }, body: form }); }
    catch (error) { throw new Error(`${name}: ${error.message} (${error.cause?.code ?? error.cause?.message})`, { cause: error }); }
    const body = await response.json().catch(() => ({}));
    if (response.status === 201 && body.id) {
      if (path.includes('resources')) { resourceIds.push(body.id); files.push(body.file_path); }
      if (path.includes('models')) { modelIds.push(body.id); files.push(body.file_path); }
      if (path.includes('videos')) { videoIds.push(body.id); files.push(body.video_path); }
    }
    return { status: response.status, body };
  };
  const sizeOf = async (table, id) => Number((await pool.query(`SELECT file_size FROM ${table} WHERE id=$1`, [id])).rows[0].file_size);
  const filler = async (owner, bytes) => { const id = (await pool.query("INSERT INTO resources(title,resource_type,file_path,is_published,program_id,owner_id,file_size) VALUES($1,'pdf','/resources/none.pdf',false,1,$2,$3) RETURNING id", [`${stamp} filler`, owner, bytes])).rows[0].id; resourceIds.push(id); return id; };
  try {
    const one = await teacher('one'), two = await teacher('two'), student = await teacher('student', 'student');

    await t.test('every upload records its size and counts towards the teacher\'s usage', async () => {
      delete process.env.UPLOAD_QUOTA_MB_PER_USER; delete process.env.UPLOAD_QUOTA_MB_TOTAL;
      const image = await upload(one, '/api/resources/upload', 'file', PNG, 'tiny.png', { resource_type: 'image' });
      assert.equal(image.status, 201);
      assert.equal(await sizeOf('resources', image.body.id), PNG.length);
      const model = await upload(one, '/api/models/upload', 'model', Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'), 'm.obj');
      assert.equal(model.status, 201); assert.equal(await sizeOf('models', model.body.id), 32);
      const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)]);
      const vtt = Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi\n');
      const form = new FormData(); form.append('title', `${stamp} v`); form.append('video', new Blob([mp4]), 'v.mp4'); form.append('captions', new Blob([vtt]), 'v.vtt');
      const video = await (await fetch(`${base}/api/videos/upload`, { method: 'POST', headers: { Authorization: `Bearer ${one.token}` }, body: form })).json();
      videoIds.push(video.id); files.push(video.video_path, video.captions_path);
      assert.equal(await sizeOf('videos', video.id), mp4.length + vtt.length, 'a video counts its captions too');
      assert.equal((await quota.usage(one.id)).mine, PNG.length + 32 + mp4.length + vtt.length);
      assert.equal((await quota.usage(two.id)).mine, 0, 'other teachers are not affected');
      const link = await (await fetch(`${base}/api/resources/upload`, { method: 'POST', headers: { Authorization: `Bearer ${one.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${stamp} link`, resource_type: 'link', url: 'https://example.com' }) })).json();
      resourceIds.push(link.id); assert.equal(await sizeOf('resources', link.id), 0, 'links use no storage');
    });

    await t.test('a teacher over their allowance is refused with a clear message, and others are unaffected', async () => {
      process.env.UPLOAD_QUOTA_MB_PER_USER = '0.01';     // about 10 KB
      const limit = Math.round(0.01 * MB);
      const full = await filler(two.id, limit);
      const before = (await pool.query('SELECT count(*)::int AS n FROM resources WHERE owner_id=$1', [two.id])).rows[0].n;
      const refused = await upload(two, '/api/resources/upload', 'file', PNG, 'over.png', { resource_type: 'image' });
      assert.equal(refused.status, 413);
      assert.match(refused.body.message, /over your storage limit.*used of 0\.0 MB|over your storage limit/);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM resources WHERE owner_id=$1', [two.id])).rows[0].n, before, 'nothing was stored');
      assert.equal((await upload(two, '/api/models/upload', 'model', Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'), 'o.obj')).status, 413, 'models too');
      assert.equal((await upload(two, '/api/videos/upload', 'video', Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom')]), 'o.mp4')).status, 413, 'and videos');
      assert.equal((await upload(student, '/api/resources/upload', 'file', PNG, 'nope.png', { resource_type: 'image' })).status, 403, 'students still cannot upload');
      assert.equal((await upload(one, '/api/resources/upload', 'file', PNG, 'fine.png', { resource_type: 'image' })).status, 201, 'a different teacher is not affected');
      await pool.query('UPDATE resources SET file_size = 0 WHERE id = $1', [full]);
      assert.equal((await upload(two, '/api/resources/upload', 'file', PNG, 'freed.png', { resource_type: 'image' })).status, 201, 'freeing space restores uploads');
      process.env.UPLOAD_QUOTA_MB_PER_USER = '0'; process.env.UPLOAD_QUOTA_MB_TOTAL = '0';   // both unlimited
      await pool.query('UPDATE resources SET file_size = $2 WHERE id = $1', [full, 1e12]);
      assert.equal((await upload(two, '/api/resources/upload', 'file', PNG, 'unlimited.png', { resource_type: 'image' })).status, 201, '0 means unlimited');
      await pool.query('UPDATE resources SET file_size = 0 WHERE id = $1', [full]);
      delete process.env.UPLOAD_QUOTA_MB_TOTAL;
    });

    await t.test('a refused upload with a large body still gets the explanation, not a dropped connection', async () => {
      process.env.UPLOAD_QUOTA_MB_PER_USER = '0.01';
      const full = await filler(two.id, Math.round(0.01 * MB));
      try {
        const large = Buffer.concat([PNG, Buffer.alloc(8 * MB, 1)]);   // 8 MB, sent in full even though it will be refused
        const refused = await upload(two, '/api/resources/upload', 'file', large, 'large.png', { resource_type: 'image' });
        assert.equal(refused.status, 413); assert.match(refused.body.message, /storage limit/);
        const afterwards = await upload(one, '/api/resources/upload', 'file', PNG, 'after.png', { resource_type: 'image' });
        assert.equal(afterwards.status, 201, 'the server keeps working normally');
      } finally { await pool.query('UPDATE resources SET file_size = 0 WHERE id = $1', [full]); delete process.env.UPLOAD_QUOTA_MB_PER_USER; }
    });

    await t.test('the site-wide limit stops everyone', async () => {
      delete process.env.UPLOAD_QUOTA_MB_PER_USER;
      const current = (await quota.usage(one.id)).total;
      process.env.UPLOAD_QUOTA_MB_TOTAL = String((current + 5) / MB);   // only 5 bytes of headroom
      for (const user of [one, two]) {
        const refused = await upload(user, '/api/resources/upload', 'file', PNG, 'site.png', { resource_type: 'image' });
        assert.equal(refused.status, 413); assert.match(refused.body.message, /run out of storage/);
      }
      delete process.env.UPLOAD_QUOTA_MB_TOTAL;
      assert.equal((await upload(one, '/api/resources/upload', 'file', PNG, 'site-ok.png', { resource_type: 'image' })).status, 201);
    });

    await t.test('teachers see their usage on their profile, students see nothing', async () => {
      process.env.UPLOAD_QUOTA_MB_PER_USER = '7';
      const profile = await (await fetch(`${base}/api/profile`, { headers: { Authorization: `Bearer ${one.token}` } })).json();
      assert.equal(profile.storage_limit_bytes, 7 * MB); assert.equal(profile.storage_used_bytes, (await quota.usage(one.id)).mine); assert.ok(profile.storage_used_bytes > 0);
      const asStudent = await (await fetch(`${base}/api/profile`, { headers: { Authorization: `Bearer ${student.token}` } })).json();
      assert.ok(!('storage_used_bytes' in asStudent));
      delete process.env.UPLOAD_QUOTA_MB_PER_USER;
    });

    await t.test('a .docx that expands into a huge file is rejected, an ordinary one is stored', async () => {
      process.env.UPLOAD_DOCX_MAX_UNCOMPRESSED_MB = '20';   // the real limit is 300 MB; a small one keeps the test fast
      const bomb = buildZip([{ name: '[Content_Types].xml', data: '<Types/>', method: 'deflate' }, { name: 'word/document.xml', data: Buffer.alloc(60 * MB), method: 'deflate' }]);
      assert.ok(bomb.length < 0.2 * MB, `bomb is ${bomb.length} bytes`);
      const refused = await upload(one, '/api/resources/upload', 'file', bomb, 'bomb.docx', { resource_type: 'document' });
      assert.equal(refused.status, 400); assert.match(refused.body.message, /expands to far more data|expands to more than 20 MB/);
      const liar = buildZip([{ name: '[Content_Types].xml', data: '<Types/>', method: 'deflate' }, { name: 'word/document.xml', data: Buffer.alloc(15 * MB), method: 'deflate', declaredSize: 2000 }]);
      assert.equal((await upload(one, '/api/resources/upload', 'file', liar, 'liar.docx', { resource_type: 'document' })).status, 400, 'lying headers are caught');
      assert.equal((await upload(one, '/api/resources/upload', 'file', buildZip([{ name: 'word/../../evil.dll', data: 'x', method: 'store' }, { name: '[Content_Types].xml', data: 'x', method: 'store' }, { name: 'word/document.xml', data: 'x', method: 'store' }]), 'slip.docx', { resource_type: 'document' })).status, 400, 'unsafe paths');
      assert.equal((await upload(one, '/api/resources/upload', 'file', buildZip([{ name: 'readme.txt', data: 'x', method: 'store' }]), 'notword.docx', { resource_type: 'document' })).status, 400, 'a zip that is not a document');
      delete process.env.UPLOAD_DOCX_MAX_UNCOMPRESSED_MB;
      const good = await upload(one, '/api/resources/upload', 'file', docx(), 'good.docx', { resource_type: 'document' });
      assert.equal(good.status, 201); assert.equal(await sizeOf('resources', good.body.id), docx().length);
    });

    await t.test('a .usdz must be stored uncompressed and must not lie about its size', async () => {
      const stored = buildZip([{ name: 'model.usdc', data: Buffer.alloc(2048, 7), method: 'store' }, { name: 'tex.png', data: PNG, method: 'store' }]);
      assert.equal((await upload(one, '/api/models/upload', 'model', stored, 'ok.usdz')).status, 201);
      assert.equal((await upload(one, '/api/models/upload', 'model', buildZip([{ name: 'model.usdc', data: Buffer.alloc(40 * MB), method: 'deflate' }]), 'bomb.usdz')).status, 400, 'a compressed entry is invalid in a USDZ');
      assert.equal((await upload(one, '/api/models/upload', 'model', buildZip([{ name: 'model.usdc', data: Buffer.alloc(100), method: 'store', declaredSize: 5 }]), 'liar.usdz')).status, 400);
      process.env.UPLOAD_USDZ_MAX_UNCOMPRESSED_MB = '0.001';
      try { assert.equal((await upload(one, '/api/models/upload', 'model', stored, 'big.usdz')).status, 400, 'the limit is configurable'); }
      finally { delete process.env.UPLOAD_USDZ_MAX_UNCOMPRESSED_MB; }
    });
  } finally {
    if (saved.user === undefined) delete process.env.UPLOAD_QUOTA_MB_PER_USER; else process.env.UPLOAD_QUOTA_MB_PER_USER = saved.user;
    if (saved.total === undefined) delete process.env.UPLOAD_QUOTA_MB_TOTAL; else process.env.UPLOAD_QUOTA_MB_TOTAL = saved.total;
    await pool.query('DELETE FROM audit_log WHERE actor_id = ANY($1::int[])', [userIds]);
    await pool.query('DELETE FROM resources WHERE id = ANY($1::int[])', [resourceIds]);
    await pool.query('DELETE FROM models WHERE id = ANY($1::int[])', [modelIds]);
    await pool.query('DELETE FROM videos WHERE id = ANY($1::int[])', [videoIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
    for (const file of files) if (file) await fs.unlink(storage.resolveAsset(file)).catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
