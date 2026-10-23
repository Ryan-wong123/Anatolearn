const app = require('./app');

function assertProductionConfig() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_ORIGINS)
    throw new Error('FRONTEND_ORIGINS must list the public site origin(s) in production');
}

if (require.main === module) {
  assertProductionConfig();
  const pool = require('./db');
  (async () => {
    if (process.env.RUN_MIGRATIONS !== 'false') {
      const { Pool } = require('pg');
      const owner = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL });
      try { await require('./migrate').migrate(owner); } finally { await owner.end(); }
    }
    require('./maintenance').startMaintenance(pool);
    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => console.log(`AnatoLearn backend running on port ${port}`));
    const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  })().catch((error) => { console.error('Startup failed:', error.message); process.exit(1); });
}

module.exports = app;
