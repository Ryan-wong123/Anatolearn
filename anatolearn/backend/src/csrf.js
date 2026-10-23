const { randomBytes, timingSafeEqual } = require('crypto');
const { readCookie } = require('./access');

const CSRF_COOKIE = 'anatolearn_csrf';
const EXEMPT = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/logout']);

function newCsrfToken() { return randomBytes(32).toString('hex'); }

// Double-submit token for browser (cookie) sessions. Requests that authenticate with an explicit
// Authorization header carry no ambient credentials and cannot be forged cross-site.
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || EXEMPT.has(req.originalUrl.split('?')[0])) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (!readCookie(req, 'anatolearn_session')) return next();
  const cookie = readCookie(req, CSRF_COOKIE) || '';
  const header = String(req.headers['x-csrf-token'] || '');
  if (cookie && cookie.length === header.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) return next();
  res.status(403).json({ message: 'Invalid or missing CSRF token. Refresh the page and try again.' });
}
module.exports = { csrfProtection, newCsrfToken, CSRF_COOKIE };
