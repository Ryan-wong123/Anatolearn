const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCache } = require('../src/cache');
function fixture(options = {}) {
  const values = new Map();
  let generation = 'one', reads = 0;
  const client = { isReady: true, async get(key) { return values.get(key) ?? null; },
    async set(key, value, config) { assert.ok(config.EX > 0); values.set(key, value); } };
  return { ...createCache({ client, version: async () => generation, ...options }), client, values,
    bump() { generation = 'two'; }, async load() { reads++; return { title: 'Heart' }; }, count: () => reads };
}
test('hits and coalesced misses return isolated objects for personalised response shaping', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.remember('catalog', [1], 30, f.load)));
  results[0].resume_position = 99;
  assert.equal(results[1].resume_position, undefined);
  assert.equal((await f.remember('catalog', [1], 30, f.load)).resume_position, undefined);
  assert.equal(f.count(), 1);
  await f.remember('catalog', [2], 30, f.load);
  assert.equal(f.count(), 2);
});
test('version changes hide stale entries even when an old read populates after commit', async () => {
  const f = fixture();
  let release;
  const old = f.remember('catalog', [1], 30, () => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  f.bump();
  await f.remember('catalog', [1], 30, f.load);
  release({ title: 'Old' });
  await old;
  assert.equal((await f.remember('catalog', [1], 30, f.load)).title, 'Heart');
  assert.equal(f.count(), 1);
});
test('disabled, disconnected, version failure and malformed JSON fall back to database', async () => {
  for (const options of [{ enabled: () => false }, { version: async () => { throw Error('version'); } }, {}]) {
    const f = fixture(options);
    if (!Object.keys(options).length) f.client.isReady = false;
    assert.equal((await f.remember('catalog', [], 30, f.load)).title, 'Heart');
  }
  const f = fixture();
  f.client.get = async () => '{broken';
  assert.equal((await f.remember('catalog', [], 30, f.load)).title, 'Heart');
});
test('slow Redis is bounded and write errors preserve successful database reads', async () => {
  const f = fixture({ timeout: 10 });
  f.client.get = () => new Promise(() => {});
  assert.equal((await f.remember('catalog', [], 30, f.load)).title, 'Heart');
  const g = fixture();
  g.client.set = async () => { throw Error('offline'); };
  assert.equal((await g.remember('catalog', [], 30, g.load)).title, 'Heart');
});
test('database failures propagate and oversized annotation data is not stored', async () => {
  const f = fixture({ maxBytes: 1 });
  await f.remember('annotations', [1], 60, f.load);
  assert.equal(f.values.size, 0);
  await assert.rejects(f.remember('catalog', [], 30, async () => { throw Error('SQL failed'); }), /SQL failed/);
});
