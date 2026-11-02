const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Each replica holds up to this many connections: size DB_POOL_MAX so replicas x DB_POOL_MAX stays below Postgres max_connections.
  max: Number(process.env.DB_POOL_MAX) > 0 ? Number(process.env.DB_POOL_MAX) : 10,
  idleTimeoutMillis: 30000,
});

module.exports = pool;