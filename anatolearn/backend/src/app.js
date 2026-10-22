const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { authenticate } = require('./access');
const app = express();
// Express 4 does not forward rejected async handlers by default.
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
  const register = app[method].bind(app);
  app[method] = (route, ...handlers) => register(route, ...handlers.map((handler) =>
    (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)));
}


app.use(cors({ origin: (origin, callback) => {
  const allowed = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',');
  callback(null, !origin || allowed.includes(origin));
}, credentials: true, exposedHeaders: ['Content-Disposition'] }));
app.use((req, res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin &&
      !(process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',').includes(req.headers.origin)) {
    return res.status(403).json({ message: 'Untrusted request origin' });
  }
  next();
});
app.use(express.json({ limit: "10mb" }));



require('./modules/publicCatalog/publicCatalog.routes')(app);
require('./modules/auth/auth.routes')(app);
app.use('/api', authenticate, require('./middleware/contentAccess'));
require('./modules/assets/assets.routes')(app);
require('./modules/assessments/assessments.routes')(app);
require('./modules/questionBank/questionBank.routes')(app);
require('./modules/questions/questions.routes')(app);
require('./modules/models/models.routes')(app);
require('./modules/catalog/catalog.routes')(app);
require('./modules/quizzes/quizzes.routes')(app);
require('./modules/annotations/annotations.routes')(app);
require('./modules/videos/videos.routes')(app);
require('./modules/resources/resources.routes')(app);
require('./modules/favorites/favorites.routes')(app);
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err instanceof multer.MulterError || /Only .*allowed/.test(err.message) ? 400 : (err.status || 500);
  res.status(status).json({ message: status === 500 ? 'The request could not be completed' : err.message });
});


module.exports = app;
