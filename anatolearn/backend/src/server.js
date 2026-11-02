const app = require('./app');
const { checkConfig, checkDatabaseRole } = require('./config');

function assertProductionConfig() {
  const { errors, warnings } = checkConfig();
  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  if (errors.length) {
    console.error(`Invalid configuration:\n - ${errors.join('\n - ')}`);
    process.exit(1);
  }
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
    if (process.env.NODE_ENV === 'production')
      for (const warning of await checkDatabaseRole(pool)) console.warn(`WARNING: ${warning}`);
    require('./maintenance').startMaintenance(pool);
    void require('./cache').start();
    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => console.log(`AnatoLearn backend running on port ${port}`));
    const shutdown = () => server.close(() => Promise.all([pool.end(), require('./cache').close()]).finally(() => process.exit(0)));
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  })().catch((error) => { console.error('Startup failed:', error.message); process.exit(1); });
}

module.exports = app;
