const { createHash } = require('node:crypto');
const { createClient } = require('redis');
const pool = require('./db');

// PostgreSQL versions change in the same transaction as the data. An old reader
// may populate an old key, but no reader starting after commit can reuse it.
function createCache({ client, version, enabled = () => true, timeout = 150, maxBytes = 2 * 1024 * 1024 }) {
  let retryAfter = 0;
  const pending = new Map();
  async function command(operation) {
    let timer;
    try {
      return await Promise.race([operation(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Cache timeout')), timeout);
      })]);
    } finally { clearTimeout(timer); }
  }
  async function remember(group, key, ttl, load) {
    if (!enabled() || !client.isReady || Date.now() < retryAfter) return load();
    let cacheKey;
    try {
      const generation = await version(group);
      if (!generation) return load();
      const digest = createHash('sha256').update(JSON.stringify(key)).digest('hex');
      cacheKey = `anatolearn:v1:${group}:${generation}:${digest}`;
      const hit = await command(() => client.get(cacheKey));
      if (hit !== null) return JSON.parse(hit);
    } catch {
      retryAfter = Date.now() + 5000;
      return load();
    }
    // Coalesce identical misses within this process. Each caller gets its own
    // JSON copy so adding resume_position or response shaping cannot leak state.
    if (!pending.has(cacheKey)) {
      const loading = (async () => {
        const value = await load();
        const encoded = JSON.stringify(value);
        if (Buffer.byteLength(encoded) <= maxBytes) {
          try { await command(() => client.set(cacheKey, encoded, { EX: ttl })); }
          catch { retryAfter = Date.now() + 5000; }
        }
        return encoded;
      })();
      pending.set(cacheKey, loading);
      void loading.finally(() => pending.delete(cacheKey)).catch(() => {});
    }
    return JSON.parse(await pending.get(cacheKey));
  }
  return { remember };
}

let client;
let connecting;
function start() {
  if (!process.env.REDIS_URL || process.env.CACHE_ENABLED === 'false' || connecting) return connecting;
  client = createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true,
    socket: { connectTimeout: 1000, reconnectStrategy: (retries) => Math.min(250 * (retries + 1), 5000) } });
  // Do not log connection URLs, which may contain credentials.
  let lastWarning = 0;
  client.on('error', (error) => {
    if (Date.now() - lastWarning > 30000) {
      console.warn(`Redis unavailable (${error.code || error.name}); cache reads will use PostgreSQL.`);
      lastWarning = Date.now();
    }
  });
  connecting = client.connect().catch(() => {});
  return connecting;
}
const cache = createCache({
  client: { get isReady() { return Boolean(client?.isReady); },
    get: (...args) => client.get(...args), set: (...args) => client.set(...args) },
  enabled: () => process.env.CACHE_ENABLED !== 'false' && Boolean(process.env.REDIS_URL),
  version: async (group) => (await pool.query('SELECT version FROM cache_versions WHERE name = $1', [group])).rows[0]?.version,
});
async function close() { if (client?.isOpen) client.destroy(); }

// Wrap only explicitly selected repository reads. Guards and transactional reads
// continue to use their original SQL. Cache plain rows, never pg result metadata.
function cachedRead(group, name, ttl, read) {
  return async (...args) => ({ rows: await cache.remember(group, [name, ...args], ttl, async () => (await read(...args)).rows) });
}
module.exports = { ...cache, start, close, cachedRead, createCache };
