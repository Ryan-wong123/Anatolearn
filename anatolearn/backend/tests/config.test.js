const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkConfig, checkDatabaseRole } = require('../src/config');

const SECRET = 'q8Wk2mZr9XvB4nLc7TjH1sYd6PfGa3Ue5RoIi0NxMtVb';
const GOOD_PRODUCTION = {
  NODE_ENV: 'production', JWT_SECRET: SECRET, DATABASE_URL: 'postgres://app@db/anatolearn', FRONTEND_ORIGINS: 'https://anatolearn.example.com',
  TRUST_PROXY: '2', MFA_REQUIRED: 'true', MFA_ENCRYPTION_KEY: 'a'.repeat(16) + 'b'.repeat(16), ALLOWED_EMAIL_DOMAINS: 'school.edu',
  TEACHER_INVITE_CODE: 'a-long-invite-code', CLAMAV_HOST: 'clamav', CLAMAV_REQUIRED: 'true',
};

test('a complete production configuration produces no errors or warnings', () => {
  assert.deepEqual(checkConfig(GOOD_PRODUCTION), { errors: [], warnings: [] });
});
test('the JWT secret and database URL are always required, with development kept permissive', () => {
  assert.equal(checkConfig({}).errors.length, 2);
  assert.match(checkConfig({ DATABASE_URL: 'x', JWT_SECRET: 'short' }).errors[0], /JWT_SECRET/);
  // Development may use an obviously fake secret as long as it is long enough, and gets no production checks.
  assert.deepEqual(checkConfig({ DATABASE_URL: 'x', JWT_SECRET: 'dev-only-secret-change-before-any-real-deployment' }), { errors: [], warnings: [] });
  assert.deepEqual(checkConfig({ DATABASE_URL: 'x', JWT_SECRET: 'ci-only-secret-0123456789abcdef0123456789' }), { errors: [], warnings: [] });
});
test('production rejects placeholder and low-variety secrets', () => {
  for (const weak of ['dev-only-secret-change-before-any-real-deployment', 'changeme'.repeat(5), 'a'.repeat(40), '01234567' + 'x'.repeat(32), 'Password-Password-Password-Password-1', 'secret-' + SECRET])
    assert.ok(checkConfig({ ...GOOD_PRODUCTION, JWT_SECRET: weak }).errors.some((error) => /JWT_SECRET/.test(error)), weak);
});
test('production requires well-formed https origins', () => {
  const origins = (value) => checkConfig({ ...GOOD_PRODUCTION, FRONTEND_ORIGINS: value }).errors;
  assert.equal(origins('https://a.example.com,https://b.example.com').length, 0);
  assert.equal(checkConfig({ ...GOOD_PRODUCTION, FRONTEND_ORIGINS: undefined }).errors.length, 1);
  for (const bad of ['http://anatolearn.example.com', 'https://anatolearn.example.com/', 'https://anatolearn.example.com/app', 'https://*.example.com',
    'anatolearn.example.com', 'https://localhost', 'https://127.0.0.1', 'https://a.example.com,http://b.example.com'])
    assert.ok(origins(bad).length > 0, bad);
});
test('an explicitly set MFA key must be long enough', () => {
  assert.equal(checkConfig({ ...GOOD_PRODUCTION, MFA_ENCRYPTION_KEY: 'short' }).errors.length, 1);
  assert.equal(checkConfig({ ...GOOD_PRODUCTION, MFA_ENCRYPTION_KEY: '' }).errors.length, 0, 'an empty value means "derive from JWT_SECRET"');
});
test('risky but workable production settings warn instead of blocking startup', () => {
  const warnings = (patch) => checkConfig({ ...GOOD_PRODUCTION, ...patch }).warnings.join('\n');
  assert.match(warnings({ TRUST_PROXY: undefined }), /TRUST_PROXY/);
  assert.match(warnings({ MFA_REQUIRED: 'false' }), /MFA_REQUIRED/);
  assert.match(warnings({ MFA_ENCRYPTION_KEY: '' }), /MFA_ENCRYPTION_KEY/);
  assert.match(warnings({ ALLOWED_EMAIL_DOMAINS: '' }), /ALLOWED_EMAIL_DOMAINS/);
  assert.match(warnings({ TEACHER_INVITE_CODE: 'abc123' }), /TEACHER_INVITE_CODE/);
  assert.match(warnings({ CLAMAV_HOST: undefined }), /CLAMAV_HOST/);
  assert.match(warnings({ CLAMAV_REQUIRED: 'false' }), /CLAMAV_REQUIRED/);
  assert.match(warnings({ DISABLE_RATE_LIMIT: 'true' }), /DISABLE_RATE_LIMIT/);
  assert.match(warnings({ AUDIT_MUTATIONS: 'false' }), /AUDIT_MUTATIONS/);
  for (const patch of [{ TRUST_PROXY: undefined }, { MFA_REQUIRED: 'false' }, { CLAMAV_HOST: undefined }]) assert.equal(checkConfig({ ...GOOD_PRODUCTION, ...patch }).errors.length, 0);
});
test('the database role check flags elevated roles only', async () => {
  const pool = (row) => ({ query: async () => ({ rows: [{ name: 'app', rolsuper: false, rolcreaterole: false, rolcreatedb: false, ...row }] }) });
  assert.deepEqual(await checkDatabaseRole(pool({})), []);
  for (const row of [{ rolsuper: true }, { rolcreaterole: true }, { rolcreatedb: true }])
    assert.match((await checkDatabaseRole(pool(row)))[0], /least-privilege/);
});
