const jwt = require('jsonwebtoken');
const { findSessionUser } = require('./modules/auth/auth.repository');

function readCookie(req, name) {
  const prefix = `${name}=`;
  const value = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
  try { return value && decodeURIComponent(value); } catch { return undefined; }
}

function sessionToken(req) {
  const bearer = req.headers.authorization;
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  return readCookie(req, 'anatolearn_session');
}

async function authenticate(req, res, next) {
  try {
    const claims = jwt.verify(sessionToken(req) || '', process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof claims.sid !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.sid)) throw new Error('Session missing');
    const result = await findSessionUser([claims.sid, claims.id]);
    if (!result.rows[0]) throw new Error('Session expired');
    req.user = { ...claims, ...result.rows[0] };
    next();
  } catch (error) {
    if (error.code && !['22P02'].includes(error.code)) return next(error);
    res.status(401).json({ message: 'Authentication required or session expired' });
  }
}

function canRead(user, content) {
  return user.role === 'teacher' || Boolean(content.is_published &&
    (content.program_id == null || content.program_id === user.program_id));
}

function canDownload(user, model) {
  return canRead(user, model) && model.is_downloadable === true;
}

module.exports = { authenticate, canRead, canDownload, sessionToken, readCookie };
