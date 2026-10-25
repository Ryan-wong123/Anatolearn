const { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } = require('crypto');

const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = 'AnatoLearn';
const STAFF_ROLES = ['teacher', 'admin'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Evaluated per call so the policy can be switched without a restart in tests.
const mfaRequired = (role) => process.env.MFA_REQUIRED === 'true' && STAFF_ROLES.includes(role);

function base32Encode(buffer) {
  let bits = 0, value = 0, output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(text) {
  let bits = 0, value = 0;
  const bytes = [];
  for (const char of text.replace(/[\s=-]/g, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid base32');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

const generateSecret = () => base32Encode(randomBytes(20));
const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

// RFC 4226 HOTP over the RFC 6238 time step.
function codeFor(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Accepts the previous, current and next step to tolerate clock drift. Returns the matching step, or null.
// Steps at or before `lastStep` are refused so a code works only once.
function verifyTotp(secret, code, { lastStep = null, now = Date.now() } = {}) {
  const candidate = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(candidate)) return null;
  const center = currentStep(now);
  let matched = null;
  for (const step of [center - 1, center, center + 1])
    if (safeEqual(codeFor(secret, step), candidate) && (lastStep == null || step > Number(lastStep))) matched = step;
  return matched;
}

function otpauthUri(email, secret) {
  return `otpauth://totp/${encodeURIComponent(`${ISSUER}:${email}`)}?secret=${secret}&issuer=${ISSUER}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// Secrets are encrypted at rest so a database dump alone cannot mint codes. MFA_ENCRYPTION_KEY is preferred;
// otherwise a key is derived from JWT_SECRET (rotating it then requires users to re-enrol).
function encryptionKey() {
  const material = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('MFA_ENCRYPTION_KEY or JWT_SECRET must be set');
  return Buffer.from(hkdfSync('sha256', material, 'anatolearn-mfa', 'totp-secret-v1', 32));
}
function encryptSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}
function decryptSecret(stored) {
  const [version, iv, tag, body] = String(stored).split(':');
  if (version !== 'v1') throw new Error('Unsupported MFA secret format');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}

// Recovery codes are 50 random bits each, so a fast keyed hash is enough; they are single use.
const normalizeRecovery = (code) => String(code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hashRecoveryCode = (code) => createHmac('sha256', encryptionKey()).update(normalizeRecovery(code)).digest('hex');
function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
const looksLikeRecoveryCode = (code) => normalizeRecovery(code).length === 10;
const fingerprint = (value) => createHash('sha256').update(value).digest('hex').slice(0, 8);

module.exports = { mfaRequired, STAFF_ROLES, generateSecret, verifyTotp, codeFor, currentStep, otpauthUri, encryptSecret, decryptSecret,
  generateRecoveryCodes, hashRecoveryCode, looksLikeRecoveryCode, base32Encode, base32Decode, fingerprint };
