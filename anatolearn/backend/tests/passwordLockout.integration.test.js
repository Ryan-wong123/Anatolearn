const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
process.env.DISABLE_RATE_LIMIT = 'true';

test('password re-checks share the login lockout, and quizzes with attempts cannot be deleted', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `lock-${Date.now()}`;
  const userIds = [], quizIds = [];
  const PASSWORD = 'Maple9Window';
  const call = (path, token, body, method = body ? 'POST' : 'GET') => fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  async function account(role, label) {
    const email = `${stamp}-${label}@example.test`;
    const id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id', [`${stamp} ${label}`, email, await bcrypt.hash(PASSWORD, 4), role])).rows[0].id;
    userIds.push(id);
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().find((c) => c.startsWith('anatolearn_session=')).split(';')[0];
    return { id, token: decodeURIComponent(cookie.split('=').slice(1).join('=')) };
  }
  const state = async (id) => (await pool.query('SELECT failed_login_count AS n, locked_until > NOW() AS locked FROM users WHERE id=$1', [id])).rows[0];
  try {
    await t.test('wrong current passwords on change-password lock the account, even for the right password afterwards', async () => {
      const user = await account('student', 'change');
      for (let i = 0; i < 4; i += 1) assert.equal((await call('/api/profile/password', user.token, { current_password: 'wrong', new_password: 'Violet7Harbour' }, 'PUT')).status, 403);
      assert.equal((await state(user.id)).n, 4);
      assert.equal((await call('/api/profile/password', user.token, { current_password: 'wrong', new_password: 'Violet7Harbour' }, 'PUT')).status, 403);
      assert.equal((await state(user.id)).locked, true);
      assert.equal((await call('/api/profile/password', user.token, { current_password: PASSWORD, new_password: 'Violet7Harbour' }, 'PUT')).status, 429);
      assert.match((await (await call('/api/profile', user.token, { password: PASSWORD }, 'DELETE')).json()).message, /Try again in \d+ minutes?/);
      assert.equal((await call('/api/profile', user.token, { password: PASSWORD }, 'DELETE')).status, 429);
      assert.equal((await pool.query('SELECT 1 FROM users WHERE id=$1', [user.id])).rows.length, 1);
    });

    await t.test('a correct password clears earlier failures', async () => {
      const user = await account('student', 'reset');
      for (let i = 0; i < 3; i += 1) await call('/api/profile/password', user.token, { current_password: 'wrong', new_password: 'Violet7Harbour' }, 'PUT');
      assert.equal((await state(user.id)).n, 3);
      assert.equal((await call('/api/profile/password', user.token, { current_password: PASSWORD, new_password: 'Violet7Harbour' }, 'PUT')).status, 200);
      assert.equal((await state(user.id)).n, 0);
    });

    await t.test('wrong passwords on delete-account and MFA setup are counted', async () => {
      const user = await account('student', 'counted');
      assert.equal((await call('/api/profile', user.token, { password: 'wrong' }, 'DELETE')).status, 403);
      assert.equal((await call('/api/profile/mfa/setup', user.token, { password: 'wrong' })).status, 403);
      assert.equal((await state(user.id)).n, 2);
    });

    await t.test('a quiz with attempts or an active session cannot be deleted', async () => {
      const teacher = await account('teacher', 'teacher'), student = await account('student', 'student');
      const make = async () => { const quiz = await (await call('/api/quizzes', teacher.token, { title: `${stamp} quiz`, type: 'MCQ', program_id: 1 })).json(); quizIds.push(quiz.id); return quiz.id; };
      const empty = await make();
      assert.equal((await call(`/api/quizzes/${empty}`, teacher.token, null, 'DELETE')).status, 200);
      const withAttempt = await make();
      const attempt = (await pool.query("INSERT INTO quiz_attempts(quiz_id,student_id,score,total_questions,correct_count,status) VALUES($1,$2,50,2,1,'graded') RETURNING id", [withAttempt, student.id])).rows[0].id;
      const refused = await call(`/api/quizzes/${withAttempt}`, teacher.token, null, 'DELETE');
      assert.equal(refused.status, 409);
      assert.match((await refused.json()).message, /Unpublish/);
      assert.equal((await pool.query('SELECT 1 FROM quiz_attempts WHERE id=$1', [attempt])).rows.length, 1);
      const withSession = await make();
      await pool.query("INSERT INTO quiz_sessions(id,quiz_id,student_id,expires_at,session_expires_at,questions) VALUES(gen_random_uuid(),$1,$2,NOW()+INTERVAL '1 hour',NOW()+INTERVAL '1 hour','[]')", [withSession, student.id]);
      assert.equal((await call(`/api/quizzes/${withSession}`, teacher.token, null, 'DELETE')).status, 409);
    });
  } finally {
    server.close();
    await pool.query('DELETE FROM quizzes WHERE id = ANY($1::int[])', [quizIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    await pool.end();
  }
});
