// Startup configuration checks. Pure (takes the environment as an argument) so they can be unit tested.
// `errors` stop the server from starting; `warnings` are logged loudly but do not.
const PLACEHOLDER_SECRET = /^(change.?me|secret|password|jwt.?secret|your[-_ ]|dev-only|example|test|todo|xxx)/i;

function checkOrigins(value, errors) {
  for (const origin of value.split(',').map((item) => item.trim())) {
    let url;
    try { url = new URL(origin); } catch { errors.push(`FRONTEND_ORIGINS contains "${origin}", which is not a valid URL`); continue; }
    if (url.protocol !== 'https:') errors.push(`FRONTEND_ORIGINS "${origin}" must use https in production`);
    if (/^(localhost|127\.|\[::1\])/i.test(url.hostname)) errors.push(`FRONTEND_ORIGINS "${origin}" points at localhost`);
    if (origin.includes('*')) errors.push(`FRONTEND_ORIGINS "${origin}" must not contain a wildcard`);
    if (url.origin !== origin) errors.push(`FRONTEND_ORIGINS "${origin}" must be a bare origin such as ${url.origin} (no path or trailing slash)`);
  }
}

function checkConfig(env = process.env) {
  const errors = [], warnings = [];
  const production = env.NODE_ENV === 'production';

  const secret = env.JWT_SECRET || '';
  if (secret.length < 32) errors.push('JWT_SECRET must be set to a random value of at least 32 characters');
  else if (production && (PLACEHOLDER_SECRET.test(secret) || new Set(secret).size < 10))
    errors.push('JWT_SECRET looks like a placeholder or has too little variety; generate one with: openssl rand -base64 48');
  if (!env.DATABASE_URL) errors.push('DATABASE_URL must be set');
  if (env.MFA_ENCRYPTION_KEY && env.MFA_ENCRYPTION_KEY.length < 32) errors.push('MFA_ENCRYPTION_KEY must be at least 32 characters (openssl rand -hex 32)');

  if (!production) return { errors, warnings };

  if (!env.FRONTEND_ORIGINS) errors.push('FRONTEND_ORIGINS must list the public site origin(s) in production');
  else checkOrigins(env.FRONTEND_ORIGINS, errors);

  if (!env.TRUST_PROXY) warnings.push('TRUST_PROXY is not set. Behind a reverse proxy every visitor shares the proxy IP, so per-IP rate limits and audit-log IPs are wrong.');
  if (env.MFA_REQUIRED !== 'true') warnings.push('MFA_REQUIRED is not "true", so teacher and admin accounts are not forced to use two-factor authentication.');
  else if (!env.MFA_ENCRYPTION_KEY) warnings.push('MFA_ENCRYPTION_KEY is not set, so authenticator secrets are encrypted with a key derived from JWT_SECRET. Rotating JWT_SECRET would then force every staff member to re-enrol.');
  if (!env.ALLOWED_EMAIL_DOMAINS) warnings.push('ALLOWED_EMAIL_DOMAINS is empty, so anyone with an email address can register as a student.');
  if (env.TEACHER_INVITE_CODE && env.TEACHER_INVITE_CODE.length < 12) warnings.push('TEACHER_INVITE_CODE is shorter than 12 characters and could be guessed.');
  if (!env.CLAMAV_HOST) warnings.push('CLAMAV_HOST is not set, so uploads are not virus scanned.');
  else if (env.CLAMAV_REQUIRED !== 'true') warnings.push('CLAMAV_REQUIRED is not "true", so uploads are accepted unscanned whenever the scanner is down.');
  if (env.DISABLE_RATE_LIMIT === 'true') warnings.push('DISABLE_RATE_LIMIT is true. Rate limiting must stay on in production.');
  if (env.AUDIT_MUTATIONS === 'false') warnings.push('AUDIT_MUTATIONS is false, so state-changing requests are not written to the audit log.');
  return { errors, warnings };
}

// The runtime database role should have DML rights only; a superuser or owner turns any SQL bug into full control.
async function checkDatabaseRole(pool) {
  const { rows: [role] } = await pool.query('SELECT current_user AS name, r.rolsuper, r.rolcreaterole, r.rolcreatedb FROM pg_roles r WHERE r.rolname = current_user');
  return role.rolsuper || role.rolcreaterole || role.rolcreatedb
    ? [`The API connects to Postgres as "${role.name}", which has elevated privileges (superuser, createrole or createdb). Use the least-privilege role created by ops/postgres-init instead.`]
    : [];
}

module.exports = { checkConfig, checkDatabaseRole };
