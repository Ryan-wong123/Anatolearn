const jwt = require('jsonwebtoken');
const { findSessionUser, touchSession } = require('./modules/auth/auth.repository');
const { idleMinutes } = require('./sessionPolicy');
const { mfaRequired } = require('./mfa');
// Staff who have not enrolled yet may reach only what they need to enrol.
const MFA_ENROLMENT_PATHS = ['/api/profile', '/api/profile/mfa/setup', '/api/profile/mfa/enable', '/api/profile/passkeys', '/api/profile/passkeys/options'];

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
    const result = await findSessionUser([claims.sid, claims.id, idleMinutes('teacher'), idleMinutes('student')]);
    if (!result.rows[0]) throw new Error('Session expired');
    const { stale, ...account } = result.rows[0];
    if (stale) void touchSession([claims.sid, claims.id]).catch((error) => console.error('Session touch failed:', error.message));
    req.user = { ...claims, ...account };
    if (mfaRequired(req.user.role) && !req.user.mfa_enabled && !MFA_ENROLMENT_PATHS.includes(req.originalUrl.split('?')[0].replace(/\/+$/, '')))
      return res.status(403).json({ code: 'mfa_setup_required', message: 'Set up two-factor authentication to continue.' });
    next();
  } catch (error) {
    if (error.code && !['22P02'].includes(error.code)) return next(error);
    res.status(401).json({ message: 'Authentication required or session expired' });
  }
}

// Students: published and in their programme. Teachers: anything published, plus their own drafts and unclaimed content, but not
// other teachers' drafts. `=== null` (not `== null`) so a row loaded without its owner_id column fails closed.
function canRead(user, content) {
  if (user.role === 'teacher') return content.is_published === true || content.owner_id === null || content.owner_id === user.id;
  return Boolean(content.is_published && (content.program_id == null || content.program_id === user.program_id));
}

function canDownload(user, model) {
  return canRead(user, model) && model.is_downloadable === true;
}

module.exports = { authenticate, canRead, canDownload, sessionToken, readCookie };
