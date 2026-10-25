const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
const { idleMinutes } = require('../src/sessionPolicy');
process.env.DISABLE_RATE_LIMIT = 'true';

test('session policy: role-based defaults and safe overrides', () => {
  assert.equal(idleMinutes('teacher', {}), 120);
  assert.equal(idleMinutes('admin', {}), 120);
  assert.equal(idleMinutes('student', {}), 480);
  assert.equal(idleMinutes('teacher', { SESSION_IDLE_MINUTES_STAFF: '30' }), 30);
  assert.equal(idleMinutes('student', { SESSION_IDLE_MINUTES_STUDENT: '60' }), 60);
  for (const bad of ['0', '-5', '4', '1441', 'abc', '', '1.5', undefined]) assert.equal(idleMinutes('teacher', { SESSION_IDLE_MINUTES_STAFF: bad }), 120, String(bad));
});

test('idle timeout, activity tracking and sign out everywhere', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `idle-${Date.now()}`;
  const userIds = [];
  const call = (path, { token, cookie, body, method = body ? 'POST' : 'GET', csrf } = {}) => fetch(base + path, { method, headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  async function signIn(role, label) {
    const email = `${stamp}-${label}@example.test`;
    let id = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0]?.id;
    if (!id) { id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id', [stamp, email, await bcrypt.hash('Maple9Window', 4), role])).rows[0].id; userIds.push(id); }
    const response = await call('/api/auth/login', { body: { email, password: 'Maple9Window' } });
    assert.equal(response.status, 200);
    const cookies = response.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.startsWith('anatolearn_session=')).split(';')[0];
    const csrf = cookies.find((cookie) => cookie.startsWith('anatolearn_csrf=')).split(';')[0].split('=')[1];
    const token = decodeURIComponent(session.split('=').slice(1).join('='));
    const sid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sid;
    return { id, token, cookie: `${session}; anatolearn_csrf=${csrf}`, csrf, sid };
  }
  const ageSession = (sid, minutes) => pool.query(`UPDATE auth_sessions SET last_seen_at = NOW() - $2::int * INTERVAL '1 minute' WHERE id = $1`, [sid, minutes]);
  const lastSeenAgo = async (sid) => Number((await pool.query(`SELECT EXTRACT(EPOCH FROM NOW() - last_seen_at) AS s FROM auth_sessions WHERE id = $1`, [sid])).rows[0].s);
  try {
    await t.test('a staff session idle past 2 hours stops working while a student session of the same age keeps working', async () => {
      const teacher = await signIn('teacher', 'teacher'), student = await signIn('student', 'student');
      assert.equal((await call('/api/profile', { token: teacher.token })).status, 200);
      await ageSession(teacher.sid, 119); await ageSession(student.sid, 119);
      assert.equal((await call('/api/profile', { token: teacher.token })).status, 200, 'just inside the staff limit');
      await ageSession(teacher.sid, 121); await ageSession(student.sid, 121);
      assert.equal((await call('/api/profile', { token: teacher.token })).status, 401, 'staff idle for 121 minutes');
      assert.equal((await call('/api/profile', { cookie: teacher.cookie })).status, 401);
      assert.equal((await call('/api/profile', { token: student.token })).status, 200, 'students get 8 hours');
      await ageSession(student.sid, 481);
      assert.equal((await call('/api/profile', { token: student.token })).status, 401, 'student idle for 481 minutes');
      assert.equal((await call('/api/models', { token: student.token })).status, 401);
    });

    await t.test('activity keeps a session alive, with the timestamp refreshed at most once a minute', async () => {
      const teacher = await signIn('teacher', 'active');
      await ageSession(teacher.sid, 90);
      assert.equal((await call('/api/profile', { token: teacher.token })).status, 200);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.ok(await lastSeenAgo(teacher.sid) < 10, 'a stale session is touched by the request');
      await ageSession(teacher.sid, 0); await pool.query("UPDATE auth_sessions SET last_seen_at = NOW() - INTERVAL '20 seconds' WHERE id = $1", [teacher.sid]);
      await call('/api/profile', { token: teacher.token }); await new Promise((resolve) => setTimeout(resolve, 300));
      assert.ok(await lastSeenAgo(teacher.sid) >= 19, 'a session seen within the last minute is not rewritten');
      // Sliding window: someone who keeps working stays signed in past the idle limit overall.
      for (let step = 0; step < 3; step += 1) { await ageSession(teacher.sid, 100); assert.equal((await call('/api/profile', { token: teacher.token })).status, 200); await new Promise((resolve) => setTimeout(resolve, 200)); }
    });

    await t.test('the absolute 24 hour limit still applies regardless of activity', async () => {
      const student = await signIn('student', 'absolute');
      await pool.query("UPDATE auth_sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [student.sid]);
      assert.equal((await call('/api/profile', { token: student.token })).status, 401);
    });

    await t.test('environment overrides change the idle limits', async () => {
      const teacher = await signIn('teacher', 'override');
      process.env.SESSION_IDLE_MINUTES_STAFF = '30';
      try {
        await ageSession(teacher.sid, 31);
        assert.equal((await call('/api/profile', { token: teacher.token })).status, 401);
        await ageSession(teacher.sid, 29);
        assert.equal((await call('/api/profile', { token: teacher.token })).status, 200);
      } finally { delete process.env.SESSION_IDLE_MINUTES_STAFF; }
    });

    await t.test('the profile reports active sessions and the idle limit, and idle or revoked sessions are not counted', async () => {
      const first = await signIn('teacher', 'count'), second = await signIn('teacher', 'count'), third = await signIn('teacher', 'count');
      const profile = await (await call('/api/profile', { token: first.token })).json();
      assert.equal(profile.active_sessions, 3);
      assert.equal(profile.session_idle_minutes, 120);
      await ageSession(second.sid, 500);
      await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [third.sid]);
      assert.equal((await (await call('/api/profile', { token: first.token })).json()).active_sessions, 1);
    });

    await t.test('sign out everywhere ends every session, including the current one, and clears the cookies', async () => {
      const laptop = await signIn('student', 'everywhere'), phone = await signIn('student', 'everywhere'), other = await signIn('student', 'someone-else');
      assert.equal((await call('/api/profile/sessions', { cookie: laptop.cookie, method: 'DELETE' })).status, 403, 'cookie sessions need the CSRF header');
      const response = await call('/api/profile/sessions', { cookie: laptop.cookie, csrf: laptop.csrf, method: 'DELETE' });
      assert.equal(response.status, 200);
      assert.match(response.headers.getSetCookie().join('\n'), /anatolearn_session=;/);
      assert.equal((await call('/api/profile', { token: laptop.token })).status, 401);
      assert.equal((await call('/api/profile', { token: phone.token })).status, 401, 'other devices are signed out too');
      assert.equal((await call('/api/profile', { token: other.token })).status, 200, 'other accounts are untouched');
      assert.equal((await call('/api/profile/sessions', { method: 'DELETE' })).status, 401, 'needs a session');
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id = $1 AND action = 'profile.signout_everywhere'", [laptop.id])).rows[0].n, 1);
    });
  } finally {
    await pool.query('DELETE FROM audit_log WHERE actor_id = ANY($1::int[])', [userIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
