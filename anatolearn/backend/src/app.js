const express = require('express');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('./access');
const requestLog = require('./requestLog');
const { csrfProtection } = require('./csrf');
const { auditMutations } = require('./audit');
const app = express();
// One reverse proxy (the web container) sits in front in production; needed for real client IPs and secure cookies.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.disable('x-powered-by');
app.use(requestLog);
// Routes match exactly ("/api/Models/1" is a different path), so the access middleware sees the same path the handler does.
app.set('case sensitive routing', true);
// Same HSTS policy as ops/Caddyfile (no includeSubDomains), so the proxy and the API never disagree.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' }, contentSecurityPolicy: false, strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false } }));
const limiter = (windowMs, limit) => rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true', message: { message: 'Too many requests. Please try again later.' } });
app.use('/api/auth/login', limiter(15 * 60 * 1000, 10));
app.use(['/api/auth/mfa', '/api/profile/mfa', '/api/profile/passkeys'], limiter(15 * 60 * 1000, 20));
app.use('/api/auth/register', limiter(60 * 60 * 1000, 10));
const uploadLimiter = limiter(60 * 60 * 1000, 60);
app.use(['/api/models/upload', '/api/resources/upload', '/api/videos/upload', '/api/videos/:id/captions'], (req, res, next) => req.method === 'POST' ? uploadLimiter(req, res, next) : next());
app.use('/api', limiter(60 * 1000, 600));
// Express 4 does not forward rejected async handlers by default.
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
  const register = app[method].bind(app);
  app[method] = (route, ...handlers) => register(route, ...handlers.map((handler) => {
    const wrapped = (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
    // Keep the handler's name and ownership marker visible, so tests can check which guards each route has.
    Object.defineProperty(wrapped, 'name', { value: handler.name });
    wrapped.ownership = handler.ownership;
    return wrapped;
  }));
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
app.use('/api', csrfProtection, auditMutations);



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
require('./modules/users/users.routes')(app);
require('./modules/profile/profile.routes')(app);
require('./modules/passkeys/passkeys.routes')(app);
require('./modules/announcements/announcements.routes')(app);
require('./modules/search/search.routes')(app);
require('./modules/dashboard/dashboard.routes')(app);
require('./modules/ownership/ownership.routes')(app);
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err instanceof multer.MulterError || /Only .*allowed/.test(err.message) ? 400 : (err.status || 500);
  res.status(status).json({ message: status === 500 ? 'The request could not be completed' : err.message });
});


module.exports = app;
