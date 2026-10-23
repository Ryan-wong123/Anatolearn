const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
// The suite signs in more often than the production login limit (10 per 15 minutes) allows.
process.env.DISABLE_RATE_LIMIT = 'true';

test('accounts, CSRF, lockout, profile, announcements, search, dashboard, pagination, audit and scanning', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `feat-${Date.now()}`;
  const userIds = [], modelIds = [], quizIds = [], announcementIds = [];
  const PASSWORD = 'Testing123';

  async function call(url, { token, cookie, csrf, body, method = body ? 'POST' : 'GET' } = {}) {
    return fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  }
  async function createUser(role, program, label = role) {
    const email = `${stamp}-${label}-${userIds.length}@example.test`;
    const id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [`${stamp} ${label}`, email, await bcrypt.hash(PASSWORD, 4), role, program])).rows[0].id;
    userIds.push(id);
    return { id, email };
  }
  async function login(email, password = PASSWORD) {
    const response = await call('/api/auth/login', { body: { email, password } });
    if (response.status !== 200) return { status: response.status };
    const cookies = response.headers.getSetCookie();
    const session = cookies.find((c) => c.startsWith('anatolearn_session='));
    const csrfCookie = cookies.find((c) => c.startsWith('anatolearn_csrf='));
    return { status: 200, token: decodeURIComponent(session.split(';')[0].split('=').slice(1).join('=')),
      cookie: `${session.split(';')[0]}; ${csrfCookie.split(';')[0]}`, csrf: csrfCookie.split(';')[0].split('=')[1], body: await response.json() };
  }
  try {
    const adminAccount = await createUser('admin', null), teacherAccount = await createUser('teacher', 1), studentAccount = await createUser('student', 1), otherAccount = await createUser('student', 2);
    const admin = await login(adminAccount.email), teacher = await login(teacherAccount.email), student = await login(studentAccount.email), other = await login(otherAccount.email);

    await t.test('login no longer returns the token in the body and sets a readable CSRF cookie', () => {
      assert.equal(teacher.body.token, undefined);
      assert.ok(teacher.csrf.length >= 32);
    });

    await t.test('cookie sessions need the CSRF header for writes; bearer tokens do not', async () => {
      const form = { title: `${stamp} csrf`, body: 'x' };
      assert.equal((await call('/api/announcements', { cookie: teacher.cookie, body: form })).status, 403);
      assert.equal((await call('/api/announcements', { cookie: teacher.cookie, csrf: 'wrong', body: form })).status, 403);
      const ok = await call('/api/announcements', { cookie: teacher.cookie, csrf: teacher.csrf, body: form });
      assert.equal(ok.status, 201); announcementIds.push((await ok.json()).id);
      const bearer = await call('/api/announcements', { token: teacher.token, body: form });
      assert.equal(bearer.status, 201); announcementIds.push((await bearer.json()).id);
    });

    await t.test('registration: teacher invite code and email domain allow-list are enforced', async () => {
      process.env.TEACHER_INVITE_CODE = 'invite-123';
      const register = (extra) => call('/api/auth/register', { body: { name: 'N', password: PASSWORD, program_id: 1, ...extra } });
      assert.equal((await register({ email: `${stamp}-t@example.test`, role: 'teacher' })).status, 403);
      process.env.ALLOWED_EMAIL_DOMAINS = 'school.edu';
      assert.equal((await register({ email: `${stamp}-s@example.test`, role: 'student' })).status, 400);
      const created = await register({ email: `${stamp}-s@school.edu`, role: 'student' });
      assert.equal(created.status, 201); userIds.push((await created.json()).id);
      delete process.env.ALLOWED_EMAIL_DOMAINS;
    });

    await t.test('five wrong passwords lock the account until an administrator unlocks it', async () => {
      const victim = await createUser('student', 1, 'victim');
      for (let i = 0; i < 5; i += 1) assert.equal((await login(victim.email, 'Wrong-pass1')).status, 401);
      assert.equal((await login(victim.email)).status, 401, 'correct password is refused while locked');
      assert.equal((await call(`/api/users/${victim.id}`, { token: student.token, method: 'PATCH', body: { unlock: true } })).status, 403);
      assert.equal((await call(`/api/users/${victim.id}`, { token: teacher.token, method: 'PATCH', body: { unlock: true } })).status, 403, 'teachers cannot unlock');
      assert.equal((await call(`/api/users/${victim.id}`, { token: admin.token, method: 'PATCH', body: { unlock: true } })).status, 200);
      assert.equal((await login(victim.email)).status, 200);
    });

    await t.test('administrator account management: create, disable, reset password, guard rails and delete', async () => {
      assert.equal((await call('/api/users', { token: student.token })).status, 403);
      assert.equal((await call('/api/users', { token: teacher.token })).status, 403, 'teachers cannot list accounts');
      assert.equal((await call('/api/users', { token: teacher.token, body: { name: 'X', email: `${stamp}-x@example.test`, role: 'student' } })).status, 403, 'teachers cannot create accounts');
      const created = await call('/api/users', { token: admin.token, body: { name: 'Managed', email: `${stamp}-managed@example.test`, role: 'student', program_id: 1 } });
      assert.equal(created.status, 201);
      const { user, temporary_password } = await created.json(); userIds.push(user.id);
      assert.ok(temporary_password);
      const session = await login(user.email, temporary_password); assert.equal(session.status, 200);
      assert.equal((await call('/api/users', { token: admin.token, body: { name: 'Dup', email: user.email, role: 'student' } })).status, 409);
      const list = await (await call(`/api/users?q=${stamp}-managed`, { token: admin.token })).json();
      assert.equal(list.length, 1);
      assert.equal((await call(`/api/users/${user.id}`, { token: admin.token, method: 'PATCH', body: { is_active: false } })).status, 200);
      assert.equal((await call('/api/models', { token: session.token })).status, 401, 'disabling revokes existing sessions');
      assert.equal((await login(user.email, temporary_password)).status, 401);
      await call(`/api/users/${user.id}`, { token: admin.token, method: 'PATCH', body: { is_active: true } });
      const reset = await (await call(`/api/users/${user.id}/reset-password`, { token: admin.token, method: 'POST', body: {} })).json();
      assert.equal((await login(user.email, temporary_password)).status, 401);
      assert.equal((await login(user.email, reset.temporary_password)).status, 200);
      assert.equal((await call(`/api/users/${adminAccount.id}`, { token: admin.token, method: 'PATCH', body: { role: 'student' } })).status, 400, 'cannot demote self');
      assert.equal((await call(`/api/users/${adminAccount.id}`, { token: admin.token, method: 'DELETE' })).status, 400, 'cannot delete self');
      const promoted = await call(`/api/users/${user.id}`, { token: admin.token, method: 'PATCH', body: { role: 'admin' } });
      assert.equal(promoted.status, 200); assert.equal((await promoted.json()).role, 'admin');
      assert.equal((await call(`/api/users/${user.id}`, { token: admin.token, method: 'DELETE' })).status, 200);
    });

    await t.test('profile: students keep their programme, password change signs out other sessions, export and delete', async () => {
      const mine = await createUser('student', 1, 'profile');
      const first = await login(mine.email), second = await login(mine.email);
      const updated = await (await call('/api/profile', { token: first.token, method: 'PUT', body: { name: 'New Name', program_id: 2 } })).json();
      assert.equal(updated.name, 'New Name'); assert.equal(updated.program_id, 1);
      assert.equal((await call('/api/profile/password', { token: first.token, method: 'PUT', body: { current_password: 'nope', new_password: 'Newpass123' } })).status, 403);
      assert.equal((await call('/api/profile/password', { token: first.token, method: 'PUT', body: { current_password: PASSWORD, new_password: 'weak' } })).status, 400);
      assert.equal((await call('/api/profile/password', { token: first.token, method: 'PUT', body: { current_password: PASSWORD, new_password: 'Newpass123' } })).status, 200);
      assert.equal((await call('/api/profile', { token: second.token })).status, 401);
      assert.equal((await call('/api/profile', { token: first.token })).status, 200);
      const exported = await call('/api/profile/export', { token: first.token });
      assert.match(exported.headers.get('content-disposition'), /attachment/);
      assert.equal((await exported.json()).account.email, mine.email);
      assert.equal((await call('/api/profile', { token: first.token, method: 'DELETE', body: { password: 'wrong' } })).status, 403);
      assert.equal((await call('/api/profile', { token: first.token, method: 'DELETE', body: { password: 'Newpass123' } })).status, 200);
      assert.equal((await login(mine.email, 'Newpass123')).status, 401);
    });

    await t.test('announcements respect programme and expiry', async () => {
      const make = async (extra) => {
        const response = await call('/api/announcements', { token: teacher.token, body: { title: `${stamp} ${extra.name}`, body: 'Body', ...extra.fields } });
        assert.equal(response.status, 201); const row = await response.json(); announcementIds.push(row.id); return row;
      };
      await make({ name: 'everyone', fields: {} });
      await make({ name: 'program1', fields: { program_id: 1 } });
      await make({ name: 'program2', fields: { program_id: 2 } });
      await make({ name: 'expired', fields: { expires_at: new Date(Date.now() - 60000).toISOString() } });
      const titles = async (user) => (await (await call('/api/announcements', { token: user.token })).json()).map((a) => a.title).filter((x) => x.startsWith(stamp));
      const forStudent = await titles(student), forOther = await titles(other), forTeacher = await titles(teacher);
      assert.ok(forStudent.includes(`${stamp} program1`) && !forStudent.includes(`${stamp} program2`) && !forStudent.includes(`${stamp} expired`));
      assert.ok(forOther.includes(`${stamp} program2`) && !forOther.includes(`${stamp} program1`));
      assert.ok(forTeacher.includes(`${stamp} expired`));
      assert.equal((await call('/api/announcements', { token: student.token, body: { title: 't', body: 'b' } })).status, 403);
    });

    await t.test('search, pagination, dashboard activity and learning statistics', async () => {
      const insertModel = async (title, published, program) => {
        const id = (await pool.query("INSERT INTO models(title,file_path,is_published,program_id,body_system) VALUES($1,'/models/anatomy/none.glb',$2,$3,'Skeletal') RETURNING id", [title, published, program])).rows[0].id;
        modelIds.push(id); return id;
      };
      const visible = await insertModel(`${stamp} femur`, true, 1);
      await insertModel(`${stamp} femur hidden`, false, 1);
      await insertModel(`${stamp} femur other`, true, 2);
      const found = await (await call(`/api/search?q=${stamp}%20femur`, { token: student.token })).json();
      assert.deepEqual(found.models.map((m) => m.title), [`${stamp} femur`]);
      assert.equal((await (await call(`/api/search?q=${stamp}%20femur`, { token: teacher.token })).json()).models.length, 3);
      assert.deepEqual((await (await call('/api/search?q=f', { token: student.token })).json()).models, []);

      const page = await call(`/api/models?published=true&page_size=1&page=1`, { token: teacher.token });
      assert.equal((await page.json()).length, 1);
      assert.ok(Number(page.headers.get('x-total-count')) >= 2);

      await call(`/api/models/${visible}`, { token: student.token });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const quiz = (await pool.query("INSERT INTO quizzes(title,category,is_published,program_id) VALUES($1,'Muscular',true,1) RETURNING id", [`${stamp} quiz`])).rows[0].id; quizIds.push(quiz);
      const q1 = (await pool.query("INSERT INTO quiz_questions(quiz_id,question,option_a,option_b,correct_option,category) VALUES($1,'a','x','y','A','Bones') RETURNING id", [quiz])).rows[0].id;
      const q2 = (await pool.query("INSERT INTO quiz_questions(quiz_id,question,option_a,option_b,correct_option,category) VALUES($1,'b','x','y','A','Nerves') RETURNING id", [quiz])).rows[0].id;
      const attempt = (await pool.query("INSERT INTO quiz_attempts(quiz_id,student_id,score,total_questions,correct_count,status) VALUES($1,$2,50,2,1,'graded') RETURNING id", [quiz, studentAccount.id])).rows[0].id;
      await pool.query("INSERT INTO quiz_attempt_answers(attempt_id,question_id,selected_option,is_correct) VALUES($1,$2,'A',true),($1,$3,'B',false)", [attempt, q1, q2]);

      const dashboard = await (await call('/api/dashboard', { token: student.token })).json();
      assert.equal(dashboard.role, 'student');
      assert.ok(dashboard.recent.some((r) => r.item_type === 'model' && r.id === visible));
      assert.equal(dashboard.quizzes.find((q) => q.quiz_id === quiz).best_score, 50);
      assert.deepEqual(dashboard.categories.filter((c) => ['Bones', 'Nerves'].includes(c.category)).map((c) => [c.category, c.accuracy]), [['Nerves', 0], ['Bones', 100]]);
      assert.equal((await call('/api/students/me/stats', { token: teacher.token })).status, 403);
      const overview = await (await call('/api/dashboard', { token: teacher.token })).json();
      assert.equal(overview.role, 'teacher'); assert.ok(overview.totals.students >= 1);
    });

    await t.test('state-changing teacher calls are audited and the log is administrator-only', async () => {
      const model = modelIds[0];
      assert.equal((await call(`/api/models/${model}/publish`, { token: teacher.token, method: 'PATCH', body: { is_published: false } })).status, 200);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const log = await (await call('/api/audit-log?action=PATCH', { token: admin.token })).json();
      assert.ok(log.some((row) => row.actor_id === teacherAccount.id && row.action === 'PATCH /models/:id/publish' && row.target_id === String(model)));
      assert.ok((await (await call('/api/audit-log?action=auth.', { token: admin.token })).json()).some((row) => row.action === 'auth.account_locked'));
      assert.equal((await call('/api/audit-log', { token: student.token })).status, 403);
      assert.equal((await call('/api/audit-log', { token: teacher.token })).status, 403);
    });

    await t.test('migrations are idempotent', async () => {
      const { migrate } = require('../src/migrate');
      const { Pool } = require('pg');
      const owner = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL });
      try { assert.deepEqual(await migrate(owner, { log() {} }), []); } finally { await owner.end(); }
    });

    await t.test('virus scanner client rejects infected files and fails closed when required', async () => {
      const { assertClean } = require('../src/scan');
      const file = path.join(os.tmpdir(), `${stamp}.bin`); fs.writeFileSync(file, 'hello');
      let reply = 'stream: OK\0'; let received = Buffer.alloc(0);
      const clamd = net.createServer((socket) => { socket.on('data', (d) => { received = Buffer.concat([received, d]); if (received.subarray(-4).equals(Buffer.alloc(4))) socket.end(reply); }); });
      await new Promise((resolve) => clamd.listen(0, '127.0.0.1', resolve));
      process.env.CLAMAV_HOST = '127.0.0.1'; process.env.CLAMAV_PORT = String(clamd.address().port);
      await assertClean({ path: file });
      assert.ok(received.toString('latin1').startsWith('zINSTREAM\0') && received.includes('hello'));
      reply = 'stream: Eicar-Test-Signature FOUND\0';
      await assert.rejects(assertClean({ path: file }), (error) => error.status === 400);
      clamd.close(); process.env.CLAMAV_REQUIRED = 'true';
      await assert.rejects(assertClean({ path: file }), (error) => error.status === 503);
      delete process.env.CLAMAV_HOST; delete process.env.CLAMAV_REQUIRED; delete process.env.CLAMAV_PORT;
      fs.unlinkSync(file);
    });
  } finally {
    if (announcementIds.length) await pool.query('DELETE FROM announcements WHERE id=ANY($1::int[]) OR title LIKE $2', [announcementIds, `${stamp}%`]);
    await pool.query('DELETE FROM announcements WHERE title LIKE $1', [`${stamp}%`]);
    await pool.query('DELETE FROM models WHERE id=ANY($1::int[])', [modelIds]);
    await pool.query('DELETE FROM quizzes WHERE id=ANY($1::int[])', [quizIds]);
    await pool.query('DELETE FROM audit_log WHERE actor_name LIKE $1', [`${stamp}%`]);
    await pool.query('DELETE FROM users WHERE name LIKE $1 OR id=ANY($2::int[]) OR email LIKE $3', [`${stamp}%`, userIds, `${stamp}%`]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
