const app = require('./app');

if (require.main === module) {
  const pool = require('./db');
  require('./maintenance').startMaintenance(pool);
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`AnatoLearn backend running on port ${port}`));
}

module.exports = app;
