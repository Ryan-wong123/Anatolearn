const jwt = require('jsonwebtoken');
const pool = require('./db');

function sessionToken(req) {
  const bearer = req.headers.authorization;
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  return (req.headers.cookie || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('anatolearn_session='))?.slice(19);
}

async function authenticate(req, res, next) {
  try {
    const claims = jwt.verify(sessionToken(req) || '', process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof claims.sid !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.sid)) throw new Error('Session missing');
    const result = await pool.query(`SELECT u.id, u.name, u.role, u.program_id FROM auth_sessions s
      JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2
      AND s.revoked_at IS NULL AND s.expires_at > NOW()`, [claims.sid, claims.id]);
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

module.exports = { authenticate, canRead, canDownload, sessionToken };
