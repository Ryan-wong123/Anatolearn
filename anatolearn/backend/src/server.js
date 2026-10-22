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
  require('./maintenance').startMaintenance(pool);
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`AnatoLearn backend running on port ${port}`));
}

module.exports = app;
