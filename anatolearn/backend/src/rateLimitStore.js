// Shared rate-limit counters. With several API replicas an in-memory store gives every pod its own counter, so the
// effective limit becomes (limit x replicas). This store keeps one fixed-window counter per key in Redis.
// When Redis is not configured or not ready it falls back to a per-process MemoryStore, so limits are never dropped.
const { MemoryStore } = require('express-rate-limit');

function createRedisRateLimitStore({ getClient, prefix, fallback = new MemoryStore() }) {
  let windowMs;
  const redisKey = (key) => `anatolearn:rl:${prefix}:${key}`;
  const ready = () => { const client = getClient(); return client?.isReady ? client : null; };
  return {
    localKeys: false,
    prefix: `anatolearn:rl:${prefix}:`,
    init(options) { windowMs = options.windowMs; fallback.init(options); },
    async increment(key) {
      const client = ready();
      if (!client) return fallback.increment(key);
      try {
        // PEXPIRE ... NX only sets the TTL on the first hit, so the window is fixed and a crash between commands cannot leave an immortal key.
        const [hits, , ttl] = await client.multi().incr(redisKey(key)).pExpire(redisKey(key), windowMs, 'NX').pTTL(redisKey(key)).exec();
        return { totalHits: Number(hits), resetTime: new Date(Date.now() + (Number(ttl) > 0 ? Number(ttl) : windowMs)) };
      } catch { return fallback.increment(key); }
    },
    async decrement(key) {
      const client = ready();
      if (client) await client.decr(redisKey(key)).catch(() => {});
      else await fallback.decrement(key);
    },
    async resetKey(key) {
      const client = ready();
      if (client) await client.del(redisKey(key)).catch(() => {});
      await fallback.resetKey(key);
    },
  };
}

// Returns undefined (express-rate-limit then uses its own MemoryStore) unless a shared store was requested.
function rateLimitStore(prefix, env = process.env, getClient = () => require('./cache').client()) {
  if (!env.REDIS_URL || env.RATE_LIMIT_STORE === 'memory') return undefined;
  return createRedisRateLimitStore({ getClient, prefix });
}

module.exports = { createRedisRateLimitStore, rateLimitStore };
