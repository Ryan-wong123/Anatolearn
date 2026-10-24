const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'unit-test-secret-0123456789abcdef0123';
const mfa = require('../src/mfa');

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (the RFC lists 8 digits; we use the last 6).
const RFC_SECRET = mfa.base32Encode(Buffer.from('12345678901234567890'));
test('TOTP matches the RFC 6238 test vectors', () => {
  assert.equal(mfa.codeFor(RFC_SECRET, Math.floor(59 / 30)), '287082');
  assert.equal(mfa.codeFor(RFC_SECRET, Math.floor(1111111109 / 30)), '081804');
  assert.equal(mfa.codeFor(RFC_SECRET, Math.floor(2000000000 / 30)), '279037');
});
test('codes are accepted within one step of drift, once, and never from the distant past or future', () => {
  const now = 1_700_000_000_000, step = mfa.currentStep(now);
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step), { now }), step);
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step - 1), { now }), step - 1);
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step + 1), { now }), step + 1);
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step - 2), { now }), null);
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step + 2), { now }), null);
  // Replay: a code at or before the last accepted step is refused.
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step), { now, lastStep: step }), null);
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step - 1), { now, lastStep: step }), null);
  assert.equal(mfa.verifyTotp(RFC_SECRET, mfa.codeFor(RFC_SECRET, step + 1), { now, lastStep: step }), step + 1);
});
test('malformed codes are rejected without throwing', () => {
  for (const bad of [undefined, null, '', '12345', '1234567', 'abcdef', 123456, {}, ['123456']])
    assert.equal(mfa.verifyTotp(RFC_SECRET, bad), null);
});
test('secrets are encrypted at rest, tamper-evident and key-bound', () => {
  const secret = mfa.generateSecret();
  const stored = mfa.encryptSecret(secret);
  assert.ok(!stored.includes(secret));
  assert.notEqual(stored, mfa.encryptSecret(secret));
  assert.equal(mfa.decryptSecret(stored), secret);
  const parts = stored.split(':'); parts[3] = Buffer.from('tampered').toString('base64');
  assert.throws(() => mfa.decryptSecret(parts.join(':')));
  process.env.MFA_ENCRYPTION_KEY = 'a-different-key';
  try { assert.throws(() => mfa.decryptSecret(stored)); } finally { delete process.env.MFA_ENCRYPTION_KEY; }
});
test('recovery codes are unique, hashed case- and dash-insensitively, and recognised by shape', () => {
  const codes = mfa.generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) {
    assert.match(code, /^[a-z2-7]{5}-[a-z2-7]{5}$/);
    assert.equal(mfa.hashRecoveryCode(code), mfa.hashRecoveryCode(code.toUpperCase().replace('-', ' ')));
    assert.ok(mfa.looksLikeRecoveryCode(code));
  }
  assert.equal(mfa.looksLikeRecoveryCode('123456'), false);
  assert.notEqual(mfa.hashRecoveryCode(codes[0]), mfa.hashRecoveryCode(codes[1]));
});
test('the MFA policy covers staff only and follows MFA_REQUIRED', () => {
  delete process.env.MFA_REQUIRED;
  assert.equal(mfa.mfaRequired('admin'), false);
  process.env.MFA_REQUIRED = 'true';
  try {
    assert.equal(mfa.mfaRequired('admin'), true);
    assert.equal(mfa.mfaRequired('teacher'), true);
    assert.equal(mfa.mfaRequired('student'), false);
  } finally { delete process.env.MFA_REQUIRED; }
});
test('the otpauth URI is importable by authenticator apps', () => {
  const uri = new URL(mfa.otpauthUri('a.teacher@example.com', RFC_SECRET));
  assert.equal(uri.protocol, 'otpauth:');
  assert.equal(uri.host, 'totp');
  assert.equal(decodeURIComponent(uri.pathname), '/AnatoLearn:a.teacher@example.com');
  assert.equal(uri.searchParams.get('secret'), RFC_SECRET);
  assert.equal(uri.searchParams.get('issuer'), 'AnatoLearn');
});
