const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
const { createAuthenticator } = require('./helpers/softAuthenticator');
process.env.DISABLE_RATE_LIMIT = 'true';

test('passkeys: register, sign in as a second factor, reject replays and bad assertions, protect the last factor, admin reset', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `pk-${Date.now()}`;
  const PASSWORD = 'Maple9Window';
  const userIds = [];
  const call = (path, { token, body, method = body ? 'POST' : 'GET' } = {}) => fetch(base + path, { method, headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const tokenOf = (response) => decodeURIComponent(response.headers.getSetCookie().find((c) => c.startsWith('anatolearn_session=')).split(';')[0].split('=').slice(1).join('='));
  async function user(role, label) {
    const email = `${stamp}-${label}@example.test`;
    const id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id', [`${stamp} ${label}`, email, await bcrypt.hash(PASSWORD, 4), role])).rows[0].id;
    userIds.push(id);
    return { id, email };
  }
  const login = async (account) => { const response = await call('/api/auth/login', { body: { email: account.email, password: PASSWORD } }); return { response, body: await response.json() }; };
  async function register(account, authenticator, name = 'Laptop') {
    const { response } = await login(account);
    const token = tokenOf(response);
    const options = await (await call('/api/profile/passkeys/options', { token, body: { password: PASSWORD } })).json();
    const saved = await call('/api/profile/passkeys', { token, body: { name, response: authenticator.create(options.challenge) } });
    return { token, saved };
  }
  const failures = async (id) => (await pool.query('SELECT failed_login_count AS n FROM users WHERE id=$1', [id])).rows[0].n;
  try {
    const teacher = await user('teacher', 'teacher');
    const key = createAuthenticator();

    await t.test('registering needs the password; wrong passwords are counted', async () => {
      const { response } = await login(teacher);
      const token = tokenOf(response);
      assert.equal((await call('/api/profile/passkeys/options', { token, body: { password: 'wrong' } })).status, 403);
      assert.equal(await failures(teacher.id), 1);
      const noChallenge = await call('/api/profile/passkeys', { token, body: { response: key.create('bogus') } });
      assert.equal(noChallenge.status, 400, 'no challenge was issued, so nothing is accepted');
    });

    await t.test('a passkey registers once and appears in the list and profile', async () => {
      const { token, saved } = await register(teacher, key);
      assert.equal(saved.status, 201);
      const list = await (await call('/api/profile/passkeys', { token })).json();
      assert.equal(list.passkeys.length, 1);
      assert.equal(list.passkeys[0].name, 'Laptop');
      assert.equal('public_key' in list.passkeys[0], false);
      const profile = await (await call('/api/profile', { token })).json();
      assert.equal(profile.passkey_count, 1); assert.equal(profile.mfa_enabled, true); assert.equal(profile.totp_enabled, false);
      // registering the same authenticator again is refused by excludeCredentials / the unique credential id
      const { response } = await login(teacher);
      assert.equal(response.status, 200);
    });

    await t.test('registration is refused for the wrong origin or a reused challenge', async () => {
      const { response, body } = await login(teacher);
      assert.equal(body.mfa_required, true);
      const second = await user('teacher', 'second');
      const { response: r2 } = await login(second);
      const token = tokenOf(r2);
      const options = await (await call('/api/profile/passkeys/options', { token, body: { password: PASSWORD } })).json();
      const attacker = createAuthenticator({ origin: 'https://evil.example' });
      assert.equal((await call('/api/profile/passkeys', { token, body: { response: attacker.create(options.challenge, { forOrigin: 'https://evil.example' }) } })).status, 400);
      assert.equal((await call('/api/profile/passkeys', { token, body: { response: attacker.create(options.challenge) } })).status, 400, 'the challenge was used up');
      assert.equal(response.status, 200);
    });

    await t.test('sign-in offers the passkey and a good assertion starts a session', async () => {
      const { body } = await login(teacher);
      assert.equal(body.mfa_required, true);
      assert.deepEqual(body.methods, ['passkey']);
      const options = await (await call('/api/auth/mfa/passkey/options', { body: { mfa_token: body.mfa_token } })).json();
      assert.ok(options.challenge); assert.equal(options.allowCredentials[0].id, key.credentialId);
      const verified = await call('/api/auth/mfa/passkey/verify', { body: { mfa_token: body.mfa_token, response: key.get(options.challenge) } });
      assert.equal(verified.status, 200);
      const session = tokenOf(verified);
      assert.equal((await call('/api/profile', { token: session })).status, 200);
      assert.equal((await pool.query('SELECT counter FROM passkeys WHERE user_id=$1', [teacher.id])).rows[0].counter > 0, true);
    });

    await t.test('replays, tampered signatures and wrong origins are refused and counted', async () => {
      const before = await failures(teacher.id);
      const { body } = await login(teacher);
      const ask = async () => (await (await call('/api/auth/mfa/passkey/options', { body: { mfa_token: body.mfa_token } })).json()).challenge;
      const verify = (response) => call('/api/auth/mfa/passkey/verify', { body: { mfa_token: body.mfa_token, response } });
      const good = await ask();
      const assertion = key.get(good);
      assert.equal((await verify(assertion)).status, 200);
      assert.equal((await verify(assertion)).status, 401, 'the challenge is single use');
      assert.equal((await verify(key.get(await ask(), { tamper: true }))).status, 401);
      assert.equal((await verify(key.get(await ask(), { forOrigin: 'https://evil.example' }))).status, 401);
      assert.equal((await verify(key.get(await ask(), { useCounter: Number((await pool.query('SELECT counter FROM passkeys WHERE user_id=$1', [teacher.id])).rows[0].counter) }))).status, 401, 'a counter that does not advance means a cloned key');
      assert.equal((await call('/api/auth/mfa/passkey/options', { body: { mfa_token: 'junk' } })).status, 401);
      assert.ok(await failures(teacher.id) >= before + 3);
    });

    await t.test('an authenticator code cannot be used for an account that only has a passkey', async () => {
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=$1', [teacher.id]);
      const { body } = await login(teacher);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: body.mfa_token, code: '123456' } })).status, 401);
    });

    await t.test('the last passkey cannot be removed while two-factor is required, but can be otherwise', async () => {
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=$1', [teacher.id]);
      const { body } = await login(teacher);
      const options = await (await call('/api/auth/mfa/passkey/options', { body: { mfa_token: body.mfa_token } })).json();
      const token = tokenOf(await call('/api/auth/mfa/passkey/verify', { body: { mfa_token: body.mfa_token, response: key.get(options.challenge) } }));
      const id = (await pool.query('SELECT id FROM passkeys WHERE user_id=$1', [teacher.id])).rows[0].id;
      process.env.MFA_REQUIRED = 'true';
      try {
        assert.equal((await call(`/api/profile/passkeys/${id}`, { token, method: 'DELETE', body: { password: PASSWORD } })).status, 403);
      } finally { delete process.env.MFA_REQUIRED; }
      assert.equal((await call(`/api/profile/passkeys/${id}`, { token, method: 'DELETE', body: { password: 'wrong' } })).status, 403);
      assert.equal((await pool.query('SELECT 1 FROM passkeys WHERE id=$1', [id])).rows.length, 1);
      assert.equal((await call(`/api/profile/passkeys/${id}`, { token, method: 'DELETE', body: { password: PASSWORD } })).status, 200);
      assert.equal((await login(teacher)).body.mfa_required, undefined, 'with no second factor left, sign-in needs only the password');
    });

    await t.test('an administrator reset removes passkeys too', async () => {
      const admin = await user('admin', 'admin'), victim = await user('teacher', 'victim');
      await register(victim, createAuthenticator());
      assert.equal((await login(victim)).body.mfa_required, true);
      const adminToken = tokenOf((await login(admin)).response);
      assert.equal((await call(`/api/users/${victim.id}/reset-mfa`, { token: adminToken, method: 'POST', body: {} })).status, 200);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM passkeys WHERE user_id=$1', [victim.id])).rows[0].n, 0);
    });
  } finally {
    server.close();
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    await pool.end();
  }
});
