const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
const mfa = require('../src/mfa');
process.env.DISABLE_RATE_LIMIT = 'true';

test('staff two-factor authentication: enrolment, challenge, replay, recovery, lockout, enforcement and admin reset', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `mfa-${Date.now()}`;
  const userIds = [];
  const call = (path, { token, body, method = body ? 'POST' : 'GET', cookie } = {}) => fetch(base + path, { method, headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined });
  const PASSWORD = 'Testing123';
  async function createUser(role, label) {
    const email = `${stamp}-${label}@example.test`;
    const id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id', [stamp, email, await bcrypt.hash(PASSWORD, 4), role])).rows[0].id;
    userIds.push(id);
    return { id, email };
  }
  const sessionFrom = (response) => {
    const cookies = response.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.startsWith('anatolearn_session='));
    return session && { cookie: session.split(';')[0], token: decodeURIComponent(session.split(';')[0].split('=').slice(1).join('=')) };
  };
  async function signIn(user) {
    const response = await call('/api/auth/login', { body: { email: user.email, password: PASSWORD } });
    assert.equal(response.status, 200);
    return { response, body: await response.json(), session: sessionFrom(response) };
  }
  // Codes for the step after the last accepted one, which stays inside the verifier's drift window.
  const nextCode = (secret, offset = 1) => mfa.codeFor(secret, mfa.currentStep() + offset);
  async function enrol(user) {
    const { session } = await signIn(user);
    const setup = await (await call('/api/profile/mfa/setup', { token: session.token, body: { password: PASSWORD } })).json();
    const enabled = await call('/api/profile/mfa/enable', { token: session.token, body: { code: mfa.codeFor(setup.secret, mfa.currentStep()) } });
    assert.equal(enabled.status, 200);
    return { secret: setup.secret, recovery: (await enabled.json()).recovery_codes, session };
  }
  async function challenge(user) {
    const { body, session } = await signIn(user);
    assert.equal(body.mfa_required, true);
    assert.equal(session, undefined, 'no session cookie may be issued before the second factor');
    return body.mfa_token;
  }
  try {
    const teacher = await createUser('teacher', 'teacher');
    let enrolment;

    await t.test('setup needs the password, enabling needs a valid code, and the secret is encrypted at rest', async () => {
      const { session } = await signIn(teacher);
      const profile = await (await call('/api/profile', { token: session.token })).json();
      assert.equal(profile.mfa_enabled, false);
      assert.equal(profile.mfa_required, false);
      assert.equal((await call('/api/profile/mfa/setup', { token: session.token, body: { password: 'wrong' } })).status, 403);
      const setup = await (await call('/api/profile/mfa/setup', { token: session.token, body: { password: PASSWORD } })).json();
      assert.match(setup.secret, /^[A-Z2-7]{32}$/);
      assert.ok(setup.otpauth_uri.startsWith('otpauth://totp/'));
      const stored = (await pool.query('SELECT mfa_secret, mfa_pending_secret, mfa_enabled_at FROM users WHERE id=$1', [teacher.id])).rows[0];
      assert.equal(stored.mfa_enabled_at, null);
      assert.ok(stored.mfa_pending_secret && !stored.mfa_pending_secret.includes(setup.secret));
      assert.equal((await call('/api/profile/mfa/enable', { token: session.token, body: { code: '000000' } })).status, 400);
      assert.equal((await call('/api/profile/mfa/enable', { token: session.token, body: {} })).status, 400);
      const enabled = await call('/api/profile/mfa/enable', { token: session.token, body: { code: mfa.codeFor(setup.secret, mfa.currentStep()) } });
      assert.equal(enabled.status, 200);
      const { recovery_codes } = await enabled.json();
      assert.equal(recovery_codes.length, 10);
      enrolment = { secret: setup.secret, recovery: recovery_codes };
      const after = (await pool.query('SELECT mfa_secret, mfa_enabled_at, mfa_recovery_hashes FROM users WHERE id=$1', [teacher.id])).rows[0];
      assert.ok(after.mfa_enabled_at && !after.mfa_secret.includes(setup.secret));
      assert.equal(after.mfa_recovery_hashes.length, 10);
      assert.ok(!JSON.stringify(after.mfa_recovery_hashes).includes(recovery_codes[0]), 'recovery codes are stored hashed');
      assert.equal((await call('/api/profile/mfa/setup', { token: session.token, body: { password: PASSWORD } })).status, 409);
      const text = await (await call('/api/profile', { token: session.token })).text();
      assert.ok(!text.includes(setup.secret) && !text.includes('mfa_secret'));
      assert.equal((await call('/api/profile', { token: session.token })).status, 200);
    });

    await t.test('signing in then needs the code; the challenge token is not a session and a session is not a challenge', async () => {
      const mfaToken = await challenge(teacher);
      assert.equal((await call('/api/profile', { token: mfaToken })).status, 401);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: mfaToken, code: '000000' } })).status, 401);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: 'garbage', code: '123456' } })).status, 401);
      assert.equal((await call('/api/auth/mfa/verify', { body: { code: '123456' } })).status, 400);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: mfaToken, code: 123456 } })).status, 400);
      const code = nextCode(enrolment.secret);
      const verified = await call('/api/auth/mfa/verify', { body: { mfa_token: mfaToken, code } });
      assert.equal(verified.status, 200);
      const session = sessionFrom(verified);
      assert.ok(session && (await verified.json()).user.email === teacher.email);
      assert.equal((await call('/api/profile', { cookie: session.cookie })).status, 200);
      // A signed-in session token must not pass for a challenge, even with a valid code.
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: session.token, code: nextCode(enrolment.secret, 0) } })).status, 401);
      // Replay: the same code, accepted once, is refused on a fresh sign-in.
      const second = await challenge(teacher);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: second, code } })).status, 401);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: second, code: nextCode(enrolment.secret, -1) } })).status, 401);
    });

    await t.test('a recovery code signs in exactly once', async () => {
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=$1', [teacher.id]);
      const [first, second] = enrolment.recovery;
      const verified = await call('/api/auth/mfa/verify', { body: { mfa_token: await challenge(teacher), code: first.toUpperCase() } });
      assert.equal(verified.status, 200);
      assert.equal((await verified.json()).recovery_codes_remaining, 9);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: await challenge(teacher), code: first } })).status, 401);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: await challenge(teacher), code: second } })).status, 200);
      const audit = (await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id=$1 AND action='auth.mfa_recovery_used'", [teacher.id])).rows[0].n;
      assert.equal(audit, 2);
    });

    await t.test('regenerating recovery codes needs password and a code, and retires the old ones', async () => {
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL, mfa_last_step=NULL WHERE id=$1', [teacher.id]);
      const login = await call('/api/auth/mfa/verify', { body: { mfa_token: await challenge(teacher), code: enrolment.recovery[2] } });
      const session = sessionFrom(login);
      assert.equal((await call('/api/profile/mfa/recovery-codes', { token: session.token, body: { password: 'wrong', code: nextCode(enrolment.secret, 0) } })).status, 403);
      assert.equal((await call('/api/profile/mfa/recovery-codes', { token: session.token, body: { password: PASSWORD, code: '000000' } })).status, 403);
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=$1', [teacher.id]);
      const fresh = await call('/api/profile/mfa/recovery-codes', { token: session.token, body: { password: PASSWORD, code: nextCode(enrolment.secret, 0) } });
      assert.equal(fresh.status, 200);
      const codes = (await fresh.json()).recovery_codes;
      assert.equal(codes.length, 10);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: await challenge(teacher), code: enrolment.recovery[3] } })).status, 401);
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=$1', [teacher.id]);
      assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: await challenge(teacher), code: codes[0] } })).status, 200);
    });

    await t.test('wrong codes lock the account like wrong passwords, even for the right code afterwards', async () => {
      const victim = await createUser('teacher', 'lockout');
      const { secret } = await enrol(victim);
      await pool.query('UPDATE users SET mfa_last_step=NULL WHERE id=$1', [victim.id]);
      const token = await challenge(victim);
      for (let attempt = 0; attempt < 5; attempt += 1)
        assert.equal((await call('/api/auth/mfa/verify', { body: { mfa_token: token, code: '000000' } })).status, 401);
      const locked = await call('/api/auth/mfa/verify', { body: { mfa_token: token, code: mfa.codeFor(secret, mfa.currentStep()) } });
      assert.equal(locked.status, 401);
      assert.equal(sessionFrom(locked), undefined);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id=$1 AND action='auth.account_locked'", [victim.id])).rows[0].n > 0, true);
    });

    await t.test('turning MFA off needs the password and a code, and sessions elsewhere are revoked', async () => {
      const user = await createUser('teacher', 'disable');
      const { secret, session } = await enrol(user);
      const other = await call('/api/auth/mfa/verify', { body: { mfa_token: await challenge(user), code: nextCode(secret) } });
      const otherSession = sessionFrom(other);
      assert.equal((await call('/api/profile/mfa/disable', { token: session.token, body: { password: PASSWORD, code: '000000' } })).status, 403);
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=$1', [user.id]);
      assert.equal((await call('/api/profile/mfa/disable', { token: session.token, body: { password: 'wrong', code: nextCode(secret, 0) } })).status, 403);
      await pool.query('UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=$1', [user.id]);
      await pool.query('UPDATE users SET mfa_last_step=NULL WHERE id=$1', [user.id]); // a new 30 s step has begun
      assert.equal((await call('/api/profile/mfa/disable', { token: session.token, body: { password: PASSWORD, code: nextCode(secret, 1) } })).status, 200);
      assert.equal((await call('/api/profile', { token: otherSession.token })).status, 401);
      const state = (await pool.query('SELECT mfa_secret, mfa_enabled_at, mfa_recovery_hashes FROM users WHERE id=$1', [user.id])).rows[0];
      assert.deepEqual([state.mfa_secret, state.mfa_enabled_at, state.mfa_recovery_hashes], [null, null, []]);
      assert.equal((await signIn(user)).body.mfa_required, undefined);
    });

    await t.test('when required, staff cannot use the API until they enrol, students are unaffected and MFA cannot be turned off', async () => {
      process.env.MFA_REQUIRED = 'true';
      try {
        const staff = await createUser('teacher', 'required');
        const student = await createUser('student', 'student');
        const { body, session } = await signIn(staff);
        assert.equal(body.mfa_setup_required, true);
        const blocked = await call('/api/models', { token: session.token });
        assert.equal(blocked.status, 403);
        assert.equal((await blocked.json()).code, 'mfa_setup_required');
        for (const path of ['/api/quizzes', '/api/dashboard', '/api/search?q=test', '/api/announcements']) assert.equal((await call(path, { token: session.token })).status, 403, path);
        assert.equal((await call('/api/announcements', { token: session.token, body: { title: 'x', body: 'y' } })).status, 403);
        const profile = await (await call('/api/profile', { token: session.token })).json();
        assert.deepEqual([profile.mfa_required, profile.mfa_enabled], [true, false]);
        assert.equal((await call('/api/models', { token: (await signIn(student)).session.token })).status, 200);
        assert.equal((await signIn(student)).body.mfa_setup_required, false);

        const setup = await (await call('/api/profile/mfa/setup', { token: session.token, body: { password: PASSWORD } })).json();
        assert.equal((await call('/api/profile/mfa/enable', { token: session.token, body: { code: mfa.codeFor(setup.secret, mfa.currentStep()) } })).status, 200);
        assert.equal((await call('/api/models', { token: session.token })).status, 200, 'the enrolling session is released once enrolled');
        const off = await call('/api/profile/mfa/disable', { token: session.token, body: { password: PASSWORD, code: nextCode(setup.secret) } });
        assert.equal(off.status, 403);
        assert.equal((await pool.query('SELECT mfa_enabled_at FROM users WHERE id=$1', [staff.id])).rows[0].mfa_enabled_at !== null, true);
        assert.equal((await signIn(staff)).body.mfa_required, true);
      } finally { delete process.env.MFA_REQUIRED; }
    });

    await t.test('only administrators can reset someone else\'s MFA, which signs them out and lets them enrol again', async () => {
      const admin = await createUser('admin', 'admin');
      const target = await createUser('teacher', 'resettable');
      const { secret, session: targetSession } = await enrol(target);
      const adminSession = (await signIn(admin)).session;
      assert.equal((await call(`/api/users/${target.id}/reset-mfa`, { token: targetSession.token, method: 'POST' })).status, 403);
      assert.equal((await call(`/api/users/${admin.id}/reset-mfa`, { token: adminSession.token, method: 'POST' })).status, 400);
      assert.equal((await call('/api/users/999999999/reset-mfa', { token: adminSession.token, method: 'POST' })).status, 404);
      const listed = await (await call(`/api/users?q=${stamp}-resettable`, { token: adminSession.token })).json();
      assert.equal(listed[0].mfa_enabled, true);
      assert.ok(!JSON.stringify(listed).includes(secret));
      assert.equal((await call(`/api/users/${target.id}/reset-mfa`, { token: adminSession.token, method: 'POST' })).status, 200);
      assert.equal((await call('/api/profile', { token: targetSession.token })).status, 401);
      assert.equal((await signIn(target)).body.mfa_required, undefined);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id=$1 AND action='user.reset_mfa'", [admin.id])).rows[0].n, 1);
      const relisted = await (await call(`/api/users?q=${stamp}-resettable`, { token: adminSession.token })).json();
      assert.equal(relisted[0].mfa_enabled, false);
    });
  } finally {
    await pool.query("DELETE FROM audit_log WHERE actor_id=ANY($1::int[])", [userIds]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::int[])', [userIds]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
