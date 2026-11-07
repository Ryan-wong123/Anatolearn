const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRedisRateLimitStore, rateLimitStore } = require('../src/rateLimitStore');

function fakeClient() {
  const counts = new Map(), ttls = new Map();
  const client = { isReady: true, calls: [],
    multi() {
      const steps = [];
      const chain = {
        incr: (k) => { steps.push(() => { counts.set(k, (counts.get(k) || 0) + 1); return counts.get(k); }); return chain; },
        pExpire: (k, ms, mode) => { steps.push(() => { client.calls.push(['pExpire', mode]); if (!ttls.has(k)) { ttls.set(k, ms); return 1; } return 0; }); return chain; },
        pTTL: (k) => { steps.push(() => ttls.get(k) ?? -1); return chain; },
        exec: async () => steps.map((run) => run()),
      };
      return chain;
    },
    async decr(k) { counts.set(k, counts.get(k) - 1); },
    async del(k) { counts.delete(k); ttls.delete(k); },
  };
  return client;
}

test('two replicas sharing Redis see one combined counter', async () => {
  const client = fakeClient();
  const a = createRedisRateLimitStore({ getClient: () => client, prefix: 'login' });
  const b = createRedisRateLimitStore({ getClient: () => client, prefix: 'login' });
  a.init({ windowMs: 1000 }); b.init({ windowMs: 1000 });
  assert.equal((await a.increment('1.2.3.4')).totalHits, 1);
  assert.equal((await b.increment('1.2.3.4')).totalHits, 2);
  assert.equal((await a.increment('5.6.7.8')).totalHits, 1);
  assert.ok(client.calls.every(([, mode]) => mode === 'NX'), 'window is set once, on the first hit');
  await b.decrement('1.2.3.4');
  assert.equal((await a.increment('1.2.3.4')).totalHits, 2);
  await a.resetKey('1.2.3.4');
  assert.equal((await b.increment('1.2.3.4')).totalHits, 1);
});

test('falls back to per-process counting when Redis is not ready or errors', async () => {
  const client = fakeClient(); client.isReady = false;
  const store = createRedisRateLimitStore({ getClient: () => client, prefix: 'x' });
  store.init({ windowMs: 1000 });
  assert.equal((await store.increment('k')).totalHits, 1);
  assert.equal((await store.increment('k')).totalHits, 2);
  client.isReady = true; client.multi = () => { throw new Error('boom'); };
  assert.equal((await store.increment('k')).totalHits, 3);
});

test('shared store is only used when REDIS_URL is set and not opted out', () => {
  assert.equal(rateLimitStore('a', {}), undefined);
  assert.equal(rateLimitStore('a', { REDIS_URL: 'redis://r', RATE_LIMIT_STORE: 'memory' }), undefined);
  assert.ok(rateLimitStore('a', { REDIS_URL: 'redis://r' }, () => undefined));
});
