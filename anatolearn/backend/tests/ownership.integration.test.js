const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
const storage = require('../src/storage');
process.env.DISABLE_RATE_LIMIT = 'true';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9x8AAAAASUVORK5CYII=';

test('content ownership: teachers manage only their own content and see only their own quizzes\' attempts', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = `own-${Date.now()}`;
  const userIds = [], modelIds = [], videoIds = [], resourceIds = [], quizIds = [], bankIds = [], announcementIds = [], files = [];
  const call = (path, token, body, method = body ? 'POST' : 'GET') => fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (path, token, body, method) => (await call(path, token, body, method)).json();
  async function account(role, label) {
    const email = `${stamp}-${label}@example.test`;
    const id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id', [`${stamp} ${label}`, email, await bcrypt.hash('Maple9Window', 4), role])).rows[0].id;
    userIds.push(id);
    const response = await call('/api/auth/login', null, { email, password: 'Maple9Window' });
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith('anatolearn_session=')).split(';')[0];
    return { id, email, name: `${stamp} ${label}`, token: decodeURIComponent(cookie.split('=').slice(1).join('=')) };
  }
  const owner = async (table, id) => (await pool.query(`SELECT ${table === 'announcements' ? 'created_by' : 'owner_id'} AS o FROM ${table} WHERE id=$1`, [id])).rows[0]?.o;
  try {
    const A = await account('teacher', 'a'), B = await account('teacher', 'b'), student = await account('student', 'student'), admin = await account('admin', 'admin');

    // ---- A's content, created through the API wherever the API can create it
    const quiz = await json('/api/quizzes', A.token, { title: `${stamp} quiz`, type: 'Mixed', program_id: 1 }); quizIds.push(quiz.id);
    const resource = await json('/api/resources/upload', A.token, { title: `${stamp} resource`, resource_type: 'link', url: 'https://example.com', program_id: 1 }); resourceIds.push(resource.id);
    const announcement = await json('/api/announcements', A.token, { title: `${stamp} notice`, body: 'hello' }); announcementIds.push(announcement.id);
    const modelForm = new FormData(); modelForm.append('title', `${stamp} model`); modelForm.append('program_id', '1');
    modelForm.append('model', new Blob(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n']), 'a.obj');
    const model = await (await fetch(base + '/api/models/upload', { method: 'POST', headers: { Authorization: `Bearer ${A.token}` }, body: modelForm })).json(); modelIds.push(model.id); files.push(model.file_path);
    const videoForm = new FormData(); videoForm.append('title', `${stamp} video`); videoForm.append('program_id', '1');
    videoForm.append('video', new Blob([Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)])]), 'a.mp4');
    const video = await (await fetch(base + '/api/videos/upload', { method: 'POST', headers: { Authorization: `Bearer ${A.token}` }, body: videoForm })).json(); videoIds.push(video.id); files.push(video.video_path);
    const mcq = (await pool.query("INSERT INTO quiz_questions(quiz_id,question,option_a,option_b,option_c,option_d,correct_option) VALUES($1,'Pick B','A','B','C','D','B') RETURNING *", [quiz.id])).rows[0];
    const open = (await pool.query("INSERT INTO quiz_questions(quiz_id,question,format,model_answer) VALUES($1,'Name a bone','open_ended','Femur') RETURNING *", [quiz.id])).rows[0];
    const annotation = await json(`/api/models/${model.id}/annotations`, A.token, { annotation_type: 'point', label: `${stamp} label`, annotation_data: { x: 0, y: 0, z: 0 } });
    const bank = await json(`/api/question-bank/from-question/${mcq.id}`, A.token, { category: 'Bones' }); bankIds.push(bank.id);

    await t.test('everything a teacher creates is recorded as theirs', async () => {
      assert.equal(await owner('quizzes', quiz.id), A.id);
      assert.equal(await owner('resources', resource.id), A.id);
      assert.equal(await owner('announcements', announcement.id), A.id);
      assert.equal(await owner('models', model.id), A.id);
      assert.equal(await owner('videos', video.id), A.id);
      assert.equal(await owner('question_bank', bank.id), A.id);
      assert.equal(quiz.can_manage, true); assert.equal(quiz.owner_name, A.name);
    });

    // publish A's content so B can see it (and so a refusal is a 403, not a 404)
    for (const [path, id] of [['models', model.id], ['videos', video.id], ['quizzes', quiz.id], ['resources', resource.id]])
      assert.equal((await call(`/api/${path}/${id}/publish`, A.token, { is_published: true }, 'PATCH')).status, 200, `A publishes ${path}`);

    await t.test('another teacher is refused on every write route and nothing changes', async () => {
      const attempt = await (async () => {
        const started = await json(`/api/quizzes/${quiz.id}/start`, student.token, {});
        const done = await json(`/api/quizzes/${quiz.id}/submit`, student.token, { session_id: started.session_id, answers: [{ question_id: mcq.id, selected_option: 'B' }, { question_id: open.id, answer_text: 'Femur' }] });
        return done.attempt;
      })();
      const answers = (await pool.query('SELECT id FROM quiz_attempt_answers WHERE attempt_id=$1 AND question_id=$2', [attempt.id, open.id])).rows[0];
      const blocked = [
        ['PUT', `/api/models/${model.id}`, { title: 'hijacked' }], ['DELETE', `/api/models/${model.id}`], ['PATCH', `/api/models/${model.id}/publish`, { is_published: false }],
        ['PATCH', `/api/models/${model.id}/neutral-view`, { cameraPosition: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } }],
        ['PATCH', `/api/models/${model.id}/download-permission`, { is_downloadable: true }], ['PATCH', `/api/models/${model.id}/thumbnail`, { thumbnailDataUrl: PNG }],
        ['POST', `/api/models/${model.id}/annotations`, { annotation_type: 'point', label: 'x', annotation_data: {} }],
        ['PUT', `/api/annotations/${annotation.id}`, { annotation_type: 'point', label: 'hijacked', annotation_data: {} }], ['DELETE', `/api/annotations/${annotation.id}`],
        ['PUT', `/api/videos/${video.id}`, { title: 'hijacked' }], ['DELETE', `/api/videos/${video.id}`], ['PATCH', `/api/videos/${video.id}/publish`, { is_published: false }], ['DELETE', `/api/videos/${video.id}/captions`],
        ['PUT', `/api/resources/${resource.id}`, { title: 'hijacked', url: 'https://example.org' }], ['DELETE', `/api/resources/${resource.id}`], ['PATCH', `/api/resources/${resource.id}/publish`, { is_published: false }],
        ['PUT', `/api/quizzes/${quiz.id}`, { title: 'hijacked' }], ['DELETE', `/api/quizzes/${quiz.id}`], ['PATCH', `/api/quizzes/${quiz.id}/publish`, { is_published: false }],
        ['PATCH', `/api/quizzes/${quiz.id}/timer`, { time_limit_seconds: 60 }], ['PATCH', `/api/quizzes/${quiz.id}/type`, { type: 'MCQ' }],
        ['POST', `/api/quizzes/${quiz.id}/questions`, { question: 'q', format: 'mcq', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', correct_option: 'A' }],
        ['PUT', `/api/questions/${mcq.id}`, { question: 'hijacked', format: 'mcq', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', correct_option: 'A' }], ['DELETE', `/api/questions/${mcq.id}`],
        ['GET', `/api/quizzes/${quiz.id}/attempts`], ['GET', `/api/quizzes/${quiz.id}/attempts/pending`],
        ['POST', `/api/quizzes/${quiz.id}/bank-questions/${bank.id}`, {}], ['PUT', `/api/question-bank/${bank.id}`, { question: 'hijacked', format: 'open_ended', model_answer: 'x' }], ['DELETE', `/api/question-bank/${bank.id}`],
        ['POST', `/api/question-bank/from-question/${mcq.id}`, { category: 'steal' }],
        ['PUT', `/api/announcements/${announcement.id}`, { title: 'hijacked', body: 'x' }], ['DELETE', `/api/announcements/${announcement.id}`],
        ['PATCH', `/api/attempt-answers/${answers.id}/grade`, { teacher_score: 100 }],
        ...['models', 'videos', 'quizzes', 'resources'].map((kind) => ['PATCH', `/api/${kind}/${{ models: model, videos: video, quizzes: quiz, resources: resource }[kind].id}/program`, { program_id: 2 }]),
      ];
      for (const [method, path, body] of blocked) {
        const response = await call(path, B.token, body, method);
        assert.equal(response.status, 403, `${method} ${path} must be refused for a teacher who does not own it`);
      }
      const unchanged = async (table, column, value) => assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE ${column}=$1`, [value])).rows.length, 1, `${table} row survived`);
      await unchanged('models', 'title', `${stamp} model`); await unchanged('videos', 'title', `${stamp} video`); await unchanged('resources', 'title', `${stamp} resource`);
      await unchanged('quizzes', 'title', `${stamp} quiz`); await unchanged('announcements', 'title', `${stamp} notice`); await unchanged('annotations', 'label', `${stamp} label`);
      assert.equal((await pool.query('SELECT correct_option FROM quiz_questions WHERE id=$1', [mcq.id])).rows[0].correct_option, 'B');
      assert.equal((await pool.query('SELECT teacher_score FROM quiz_attempt_answers WHERE id=$1', [answers.id])).rows[0].teacher_score, null);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM quiz_questions WHERE quiz_id=$1', [quiz.id])).rows[0].n, 2);
      assert.equal((await pool.query('SELECT program_id FROM quizzes WHERE id=$1', [quiz.id])).rows[0].program_id, 1);

      // The owner is never blocked by the same routes.
      assert.equal((await call(`/api/models/${model.id}`, A.token, { title: `${stamp} model` }, 'PUT')).status, 200);
      assert.equal((await call(`/api/quizzes/${quiz.id}/attempts`, A.token)).status, 200);
      assert.equal((await call(`/api/attempt-answers/${answers.id}/grade`, A.token, { teacher_score: 80 }, 'PATCH')).status, 200);
      assert.equal((await call(`/api/announcements/${announcement.id}`, A.token, { title: `${stamp} notice`, body: 'updated' }, 'PUT')).status, 200);
      assert.equal((await call(`/api/question-bank/${bank.id}`, A.token, { question: 'Pick B', format: 'open_ended', model_answer: 'B', category: 'Bones' }, 'PUT')).status, 200);
      t.attempt = attempt;
    });

    await t.test('attempts, answers and the dashboard of a quiz are visible only to the teacher who owns it', async () => {
      const { attempt } = t;
      assert.equal((await call(`/api/attempts/${attempt.id}`, B.token)).status, 404);
      assert.equal((await call(`/api/attempts/${attempt.id}/answers`, B.token)).status, 404);
      assert.equal((await call(`/api/attempts/${attempt.id}`, A.token)).status, 200);
      assert.equal((await call(`/api/attempts/${attempt.id}/answers`, A.token)).status, 200);
      assert.equal((await call(`/api/attempts/${attempt.id}`, student.token)).status, 200, 'the student still sees their own attempt');
      assert.equal((await call(`/api/attempts/${attempt.id}`, admin.token)).status, 404, 'administrators have no learning data');
      const mine = await json('/api/teacher/overview', A.token), theirs = await json('/api/teacher/overview', B.token);
      assert.ok(mine.recent_attempts.some((row) => row.quiz_id === quiz.id), 'the owner sees the attempt');
      assert.ok(mine.quiz_performance.some((row) => row.quiz_id === quiz.id));
      assert.ok(!theirs.recent_attempts.some((row) => row.quiz_id === quiz.id), 'another teacher does not see the attempt');
      assert.ok(!theirs.quiz_performance.some((row) => row.quiz_id === quiz.id));
      assert.ok(!JSON.stringify(theirs).includes(`${stamp} student`), 'nor the student\'s name');
      const dashboard = await json('/api/dashboard', B.token);
      assert.ok(!dashboard.recent_attempts.some((row) => row.quiz_id === quiz.id));
      assert.ok(theirs.totals.quizzes < mine.totals.quizzes + 1 && !(await pool.query('SELECT 1')).rows.length === false);
    });

    await t.test('answer keys go only to the quiz owner; other teachers and students never get them', async () => {
      const keyed = async (token) => JSON.stringify(await json(`/api/quizzes/${quiz.id}/questions`, token));
      assert.ok((await keyed(A.token)).includes('correct_option') && (await keyed(A.token)).includes('Femur'));
      for (const token of [B.token, student.token]) { const body = await keyed(token); assert.ok(!body.includes('correct_option') && !body.includes('model_answer') && !body.includes('Femur')); assert.ok(body.includes('Pick B')); }
    });

    await t.test('another teacher can read published content but never anyone\'s drafts', async () => {
      const draftModel = (await pool.query("INSERT INTO models(title,file_path,is_published,program_id,owner_id) VALUES($1,$2,false,1,$3) RETURNING id", [`${stamp} draft model`, `/models/anatomy/${stamp}-draft.obj`, A.id])).rows[0];
      modelIds.push(draftModel.id);
      const draftPath = storage.resolveAsset(`/models/anatomy/${stamp}-draft.obj`); files.push(`/models/anatomy/${stamp}-draft.obj`);
      await fs.mkdir(require('path').dirname(draftPath), { recursive: true }); await fs.writeFile(draftPath, 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
      const draftQuiz = (await pool.query("INSERT INTO quizzes(title,type,is_published,program_id,owner_id) VALUES($1,'MCQ',false,1,$2) RETURNING id", [`${stamp} draft quiz`, A.id])).rows[0]; quizIds.push(draftQuiz.id);
      const draftAnnotation = (await pool.query("INSERT INTO annotations(model_id,annotation_type,label,annotation_data) VALUES($1,'point',$2,'{}') RETURNING id", [draftModel.id, `${stamp} secret label`])).rows[0];
      assert.equal((await call(`/api/models/${model.id}`, B.token)).status, 200, 'published: readable');
      assert.equal((await call(`/api/quizzes/${quiz.id}/questions`, B.token)).status, 200);
      assert.equal((await call(`/api/models/${draftModel.id}`, B.token)).status, 404, 'draft: invisible');
      assert.equal((await call(`/api/models/${draftModel.id}/annotations`, B.token)).status, 404);
      assert.equal((await call(`/api/quizzes/${draftQuiz.id}/questions`, B.token)).status, 404);
      assert.equal((await call(`/api/models/${draftModel.id}`, B.token, { title: 'x' }, 'PUT')).status, 404, 'writes to a draft are also 404, not 403');
      assert.equal((await call(`/api/models/${draftModel.id}`, A.token)).status, 200);
      assert.equal((await call(`/api/models/anatomy/${stamp}-draft.obj`, B.token)).status, 404, 'the draft file is not served');
      assert.equal((await call(`/models/anatomy/${stamp}-draft.obj`, B.token)).status, 404);
      assert.equal((await call(`/models/anatomy/${stamp}-draft.obj`, A.token)).status, 200);
      const ids = async (path, token) => (await json(path, token)).map((row) => row.id);
      assert.ok(!(await ids('/api/models', B.token)).includes(draftModel.id) && (await ids('/api/models', A.token)).includes(draftModel.id));
      assert.ok(!(await ids('/api/quizzes', B.token)).includes(draftQuiz.id) && (await ids('/api/quizzes', A.token)).includes(draftQuiz.id));
      assert.ok((await ids('/api/models', B.token)).includes(model.id), 'published content is listed for every teacher');
      assert.ok(!(await json('/api/annotations', B.token)).some((row) => row.id === draftAnnotation.id), 'annotations of drafts are not listed');
      assert.ok((await json('/api/annotations', A.token)).some((row) => row.id === draftAnnotation.id));
      assert.ok(!JSON.stringify(await json(`/api/search?q=${stamp}%20secret`, B.token)).includes('secret label'));
      assert.ok(JSON.stringify(await json(`/api/search?q=${stamp}%20secret`, A.token)).includes('secret label'));
      assert.ok(!JSON.stringify(await json(`/api/search?q=${stamp}%20draft`, B.token)).includes('draft model'));
    });

    await t.test('lists tell teachers what they can change, and students never see owner details', async () => {
      const asB = (await json('/api/models', B.token)).find((row) => row.id === model.id);
      assert.deepEqual([asB.can_manage, asB.owner_name], [false, A.name]);
      const asA = (await json('/api/models', A.token)).find((row) => row.id === model.id);
      assert.deepEqual([asA.can_manage, asA.owner_name], [true, A.name]);
      assert.equal((await json(`/api/videos/${video.id}`, B.token)).can_manage, false);
      assert.equal((await json('/api/resources', B.token)).find((row) => row.id === resource.id).can_manage, false);
      assert.equal((await json('/api/announcements', B.token)).find((row) => row.id === announcement.id).can_manage, false);
      assert.equal((await json('/api/announcements', A.token)).find((row) => row.id === announcement.id).can_manage, true);
      assert.equal((await json('/api/question-bank', B.token)).some((row) => row.id === bank.id), false, 'the question bank is per teacher');
      assert.equal((await json('/api/question-bank', A.token)).some((row) => row.id === bank.id), true);
      for (const path of ['/api/models', '/api/quizzes', '/api/videos', '/api/resources']) {
        const rows = await json(path, student.token);
        assert.ok(rows.length > 0, path);
        for (const row of rows) for (const key of ['owner_id', 'can_manage', 'owner_name']) assert.ok(!(key in row), `${path} must not expose ${key} to students`);
      }
      assert.ok(!('owner_id' in (await json(`/api/models/${model.id}`, student.token))));
      const found = (await json(`/api/search?q=${stamp}`, student.token)).models;
      assert.ok(found.length > 0 && found.every((row) => !('owner_id' in row)));
    });

    await t.test('unclaimed content can be managed by any teacher until someone claims it', async () => {
      const legacy = (await pool.query("INSERT INTO resources(title,resource_type,file_path,is_published,program_id) VALUES($1,'link','https://example.com',false,1) RETURNING id", [`${stamp} legacy`])).rows[0]; resourceIds.push(legacy.id);
      assert.equal((await json('/api/resources', B.token)).find((row) => row.id === legacy.id).can_manage, true);
      assert.equal((await call(`/api/resources/${legacy.id}`, B.token, { title: `${stamp} legacy edited`, url: 'https://example.com' }, 'PUT')).status, 200);
      assert.equal((await call(`/api/resources/${legacy.id}/claim`, student.token, {})).status, 403, 'students cannot claim');
      assert.equal((await call(`/api/resources/${legacy.id}/claim`, A.token, {})).status, 200);
      assert.equal(await owner('resources', legacy.id), A.id);
      assert.equal((await call(`/api/resources/${legacy.id}/claim`, A.token, {})).status, 200, 'claiming your own is a no-op');
      assert.equal((await call(`/api/resources/${legacy.id}/claim`, B.token, {})).status, 404, 'another teacher\'s draft is not even confirmed to exist');
      assert.equal((await call(`/api/resources/${legacy.id}`, B.token, { title: 'x', url: 'https://example.com' }, 'PUT')).status, 404);
      await pool.query('UPDATE resources SET is_published = true WHERE id = $1', [legacy.id]);
      assert.equal((await call(`/api/resources/${legacy.id}/claim`, B.token, {})).status, 409, 'once visible, an owned item cannot be taken');
      assert.equal((await call(`/api/resources/${legacy.id}`, B.token, { title: 'x', url: 'https://example.com' }, 'PUT')).status, 403, 'and is protected once claimed');
      assert.equal((await call(`/api/resources/999999999/claim`, A.token, {})).status, 404);
      assert.equal((await call(`/api/users/claim`, A.token, {})).status, 404);
      assert.equal((await call(`/api/users/1/claim`, A.token, {})).status, 404, 'only content kinds can be claimed');
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id=$1 AND action='content.claim'", [A.id])).rows[0].n, 1);
    });

    await t.test('administrators move content between teachers and assign unclaimed content', async () => {
      const spare = await account('teacher', 'spare');
      const mine = (await pool.query("INSERT INTO resources(title,resource_type,file_path,is_published,program_id,owner_id) VALUES($1,'link','https://example.com',true,1,$2) RETURNING id", [`${stamp} spare`, spare.id])).rows[0]; resourceIds.push(mine.id);
      const orphan = (await pool.query("INSERT INTO resources(title,resource_type,file_path,is_published,program_id) VALUES($1,'link','https://example.com',false,1) RETURNING id", [`${stamp} orphan`])).rows[0]; resourceIds.push(orphan.id);
      for (const token of [A.token, student.token]) assert.equal((await call(`/api/users/${spare.id}/transfer-content`, token, { to_user_id: B.id })).status, 403, 'administrators only');
      assert.equal((await call(`/api/users/${spare.id}/transfer-content`, admin.token, { to_user_id: student.id })).status, 400, 'the receiver must be a teacher');
      assert.equal((await call(`/api/users/${spare.id}/transfer-content`, admin.token, { to_user_id: spare.id })).status, 400);
      assert.equal((await call('/api/users/999999999/transfer-content', admin.token, { to_user_id: B.id })).status, 404);
      const moved = await json(`/api/users/${spare.id}/transfer-content`, admin.token, { to_user_id: B.id });
      assert.equal(moved.moved.resources, 1); assert.equal(moved.to, B.name);
      assert.equal(await owner('resources', mine.id), B.id);
      assert.equal((await call(`/api/resources/${mine.id}`, spare.token, { title: 'x', url: 'https://example.com' }, 'PUT')).status, 403, 'the previous owner loses access');
      assert.equal((await call(`/api/resources/${mine.id}`, B.token, { title: `${stamp} spare`, url: 'https://example.com' }, 'PUT')).status, 200);
      assert.equal((await call('/api/content/assign-unclaimed', A.token, { to_user_id: A.id })).status, 403);
      const assigned = await json('/api/content/assign-unclaimed', admin.token, { to_user_id: B.id });
      assert.ok(assigned.moved.resources >= 1);
      assert.equal(await owner('resources', orphan.id), B.id);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM resources WHERE owner_id IS NULL')).rows[0].n, 0);
      assert.equal((await call('/api/content/assign-unclaimed', admin.token, { to_user_id: 999999999 })).status, 400);
      // Deleting a teacher keeps their content, unclaimed.
      assert.equal((await call(`/api/users/${spare.id}`, admin.token, null, 'DELETE')).status, 200);
      userIds.splice(userIds.indexOf(spare.id), 1);
      const kept = (await pool.query("INSERT INTO resources(title,resource_type,file_path,is_published,program_id,owner_id) VALUES($1,'link','https://example.com',true,1,$2) RETURNING id", [`${stamp} kept`, B.id])).rows[0]; resourceIds.push(kept.id);
      const gone = await account('teacher', 'leaver');
      await pool.query('UPDATE resources SET owner_id=$1 WHERE id=$2', [gone.id, kept.id]);
      assert.equal((await call(`/api/users/${gone.id}`, admin.token, null, 'DELETE')).status, 200);
      userIds.splice(userIds.indexOf(gone.id), 1);
      assert.equal(await owner('resources', kept.id), null, 'the row survives, unclaimed');
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id=$1 AND action IN ('content.transfer','content.assign_unclaimed')", [admin.id])).rows[0].n, 2);
    });

    await t.test('every teacher write route is behind an ownership guard (or is a documented exception)', () => {
      const routes = [];
      for (const layer of app._router.stack) {
        if (!layer.route) continue;
        for (const method of Object.keys(layer.route.methods)) {
          const handlers = layer.route.stack.map((entry) => entry.handle);
          routes.push({ key: `${method.toUpperCase()} ${layer.route.path}`, method, teacher: handlers.some((h) => h.name === 'requireTeacher'), guarded: handlers.some((h) => h.ownership) });
        }
      }
      // Creating something new, claiming, and reading lists that are already scoped to the teacher need no per-row guard.
      const exceptions = new Set(['POST /api/models/upload', 'POST /api/resources/upload', 'POST /api/videos/upload', 'POST /api/quizzes', 'POST /api/announcements',
        'POST /api/:kind/:id/claim', 'GET /api/models/:id/annotations/export', 'GET /api/annotations', 'GET /api/question-bank', 'GET /api/teacher/overview']);
      const teacherRoutes = routes.filter((route) => route.teacher);
      assert.ok(teacherRoutes.length >= 40, `found ${teacherRoutes.length} teacher routes`);
      const unguarded = teacherRoutes.filter((route) => !route.guarded && !exceptions.has(route.key)).map((route) => route.key);
      assert.deepEqual(unguarded, [], `teacher routes without an ownership guard: ${unguarded.join(', ')}`);
      for (const key of exceptions) assert.ok(routes.some((route) => route.key === key), `${key} no longer exists; remove it from the exceptions`);
    });
  } finally {
    await pool.query('DELETE FROM audit_log WHERE actor_id = ANY($1::int[])', [userIds]);
    await pool.query('DELETE FROM quizzes WHERE id = ANY($1::int[])', [quizIds]);
    await pool.query('DELETE FROM models WHERE id = ANY($1::int[])', [modelIds]);
    await pool.query('DELETE FROM videos WHERE id = ANY($1::int[])', [videoIds]);
    await pool.query('DELETE FROM resources WHERE id = ANY($1::int[])', [resourceIds]);
    await pool.query('DELETE FROM question_bank WHERE id = ANY($1::int[])', [bankIds]);
    await pool.query('DELETE FROM announcements WHERE id = ANY($1::int[])', [announcementIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
    for (const file of files) await fs.unlink(storage.resolveAsset(file)).catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
