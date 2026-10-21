const jwt = require('jsonwebtoken');

function sessionToken(req) {
  const bearer = req.headers.authorization;
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  return (req.headers.cookie || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('anatolearn_session='))?.slice(19);
}

function authenticate(req, res, next) {
  try {
    req.user = jwt.verify(sessionToken(req) || '', process.env.JWT_SECRET);
    next();
  } catch {
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

module.exports = { authenticate, canRead, canDownload };
