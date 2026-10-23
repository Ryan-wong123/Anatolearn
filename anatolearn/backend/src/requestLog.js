const { randomUUID } = require('crypto');

// One JSON line per request, ready for CloudWatch Logs Insights. Query strings and bodies are never logged.
module.exports = function requestLog(req, res, next) {
  if (process.env.LOG_REQUESTS === 'false' || (process.env.NODE_ENV !== 'production' && process.env.LOG_REQUESTS !== 'true')) return next();
  const id = String(req.headers['x-request-id'] || randomUUID()).slice(0, 64);
  res.setHeader('X-Request-Id', id);
  const started = process.hrtime.bigint();
  res.once('finish', () => {
    if (req.path === '/api/health') return;
    console.log(JSON.stringify({ time: new Date().toISOString(), level: res.statusCode >= 500 ? 'error' : 'info', msg: 'request', id,
      method: req.method, path: req.path, status: res.statusCode, ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
      user: req.user?.id ?? null, ip: req.ip }));
  });
  next();
};
