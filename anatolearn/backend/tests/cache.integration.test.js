const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('redis');
const pool = require('../src/db');
const cache = require('../src/cache');
const models = require('../src/modules/models/models.repository');
const annotations = require('../src/modules/annotations/annotations.repository');
const videos = require('../src/modules/videos/videos.service');
const catalog = require('../src/modules/catalog/catalog.service');
const dashboard = require('../src/modules/dashboard/dashboard.service');
const { canRead } = require('../src/access');

test('real Redis hits, transactional invalidation, rollback and access filtering', async () => {
  assert.ok(process.env.REDIS_URL, 'Run with REDIS_URL to test real Redis');
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await cache.start();
  let modelId, secondModelId, videoId;
  const userIds = [];
  const connection = await pool.connect();
  try {
    for (let i = 0; i < 2; i++) {
      userIds.push((await pool.query("INSERT INTO users(name,email,password_hash,role,program_id) VALUES ('Cache student',$1,'test-only','student',1) RETURNING id",
        [`cache-${Date.now()}-${i}@example.test`])).rows[0].id);
    }
    modelId = (await pool.query("INSERT INTO models(title,file_path,is_published,program_id) VALUES ('Cache integration','/models/cache-test.obj',true,1) RETURNING id")).rows[0].id;
    const first = await models.findModel([modelId]);
    assert.equal(first.rows[0].title, 'Cache integration');
    const infoBefore = await redis.info('stats');
    const second = await models.findModel([modelId]);
    assert.equal(second.rows[0].title, 'Cache integration');
    const hits = info => Number(info.match(/keyspace_hits:(\d+)/)[1]);
    assert.ok(hits(await redis.info('stats')) > hits(infoBefore), 'second read hits Redis');
    assert.equal(canRead({ role: 'student', program_id: 1 }, second.rows[0]), true);
    assert.equal(canRead({ role: 'student', program_id: 2 }, second.rows[0]), false);
    const input = { user: { id: userIds[0], role: 'student', program_id: 1 }, headers: {}, query: {}, params: {} };
    assert.equal((await catalog.visibleRows(input, second.rows)).length, 1);
    assert.equal((await catalog.visibleRows({ ...input, user: { ...input.user, program_id: 2 } }, second.rows)).length, 0);
    const statsBefore = (await pool.query("SELECT version FROM cache_versions WHERE name='stats'")).rows[0].version;
    assert.equal((await dashboard.getMyStats(input)).body.summary.attempts, 0);
    assert.equal((await dashboard.getMyStats(input)).body.summary.attempts, 0);
    // A profile change invalidates teacher names/headcounts and student aggregates.
    await pool.query('UPDATE users SET name=$2 WHERE id=$1', [userIds[0], 'Renamed cache student']);
    assert.notEqual((await pool.query("SELECT version FROM cache_versions WHERE name='stats'")).rows[0].version, statsBefore);
    videoId = (await pool.query("INSERT INTO videos(title,video_path,is_published,program_id) VALUES ('Cache video','/videos/cache-test.mp4',true,1) RETURNING id")).rows[0].id;
    for (let i = 0; i < 2; i++) {
      await pool.query("INSERT INTO user_activity(user_id,item_type,item_id,position_seconds) VALUES ($1,'video',$2,$3)", [userIds[i], videoId, 10 + i * 20]);
    }
    for (let i = 0; i < 2; i++) {
      const response = await videos.getVideo({ ...input, user: { ...input.user, id: userIds[i] }, params: { id: videoId } });
      assert.equal(response.body.resume_position, 10 + i * 20);
    }
    assert.equal((await videos.getVideo({ ...input, params: { id: videoId } })).body.resume_position, 10);
    await pool.query('UPDATE models SET is_published=false, title=$2 WHERE id=$1', [modelId, 'Changed']);
    const changed = (await models.findModel([modelId])).rows[0];
    assert.equal(changed.title, 'Changed');
    assert.equal(canRead({ role: 'student', program_id: 1 }, changed), false);
    const before = (await pool.query("SELECT version FROM cache_versions WHERE name='catalog'")).rows[0].version;
    await connection.query('BEGIN');
    await connection.query('UPDATE models SET title=$2 WHERE id=$1', [modelId, 'Rolled back']);
    await connection.query('ROLLBACK');
    assert.equal((await pool.query("SELECT version FROM cache_versions WHERE name='catalog'")).rows[0].version, before);
    assert.equal((await models.findModel([modelId])).rows[0].title, 'Changed');
    // Regression: unrelated writes must not hold a shared cache lock while their
    // business transaction is still open. Version changes are deferred to commit.
    secondModelId = (await pool.query("INSERT INTO models(title,file_path) VALUES ('Second cache model','/models/cache-second.obj') RETURNING id")).rows[0].id;
    const other = await pool.connect();
    try {
      const generation = (await pool.query("SELECT version FROM cache_versions WHERE name='catalog'")).rows[0].version;
      await connection.query('BEGIN');
      await other.query('BEGIN');
      await connection.query("SET LOCAL lock_timeout = '2s'");
      await other.query("SET LOCAL lock_timeout = '2s'");
      await Promise.all([
        connection.query('UPDATE models SET title=$2 WHERE id=$1', [modelId, 'Concurrent one']),
        other.query('UPDATE models SET title=$2 WHERE id=$1', [secondModelId, 'Concurrent two']),
      ]);
      assert.equal((await pool.query("SELECT version FROM cache_versions WHERE name='catalog'")).rows[0].version, generation);
      await Promise.all([connection.query('COMMIT'), other.query('COMMIT')]);
      assert.notEqual((await pool.query("SELECT version FROM cache_versions WHERE name='catalog'")).rows[0].version, generation);
    } finally {
      await connection.query('ROLLBACK');
      await other.query('ROLLBACK');
      other.release();
    }
    assert.equal((await annotations.listForModel([modelId])).rows.length, 0);
    await pool.query("INSERT INTO annotations(model_id,annotation_type,label,annotation_data) VALUES ($1,'point','New label','{}')", [modelId]);
    assert.equal((await annotations.listForModel([modelId])).rows[0].label, 'New label');
    await pool.query('DELETE FROM models WHERE id=$1', [modelId]);
    assert.equal((await models.findModel([modelId])).rows.length, 0);
    // Deliberately disconnect the application client: optional cache must not gate reads.
    await cache.close();
    assert.equal((await models.findModel([modelId])).rows.length, 0);
  } finally {
    await connection.query('ROLLBACK');
    connection.release();
    if (modelId) await pool.query('DELETE FROM models WHERE id=$1', [modelId]);
    if (secondModelId) await pool.query('DELETE FROM models WHERE id=$1', [secondModelId]);
    if (videoId) await pool.query('DELETE FROM videos WHERE id=$1', [videoId]);
    if (userIds.length) await pool.query('DELETE FROM users WHERE id=ANY($1::int[])', [userIds]);
    await cache.close();
    await redis.quit();
    await pool.end();
  }
});
