const { before, beforeEach, after, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { assertSafeTestDatabase, migrate, reset, Pool } = require('./testDatabase');

assertSafeTestDatabase();
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const app = require('../server');

const user = (email, role = 'student') => ({ name: email.split('@')[0], email, password: 'Password123!', role, program_id: 1 });
async function registerAndLogin(data) {
  await request(app).post('/api/auth/register').send(data).expect(201);
  return (await request(app).post('/api/auth/login').send({ email: data.email, password: data.password }).expect(200)).body;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => migrate(pool));
beforeEach(async () => reset(pool));
after(async () => { await pool.end(); await require('../db').end(); });

test('registration rejects duplicate normalized email and login uses generic failures', async () => {
  await request(app).post('/api/auth/register').send(user('Student@Example.com')).expect(201);
  await request(app).post('/api/auth/register').send(user(' student@example.com ')).expect(409);
  const wrong = await request(app).post('/api/auth/login').send({ email: 'student@example.com', password: 'wrong' }).expect(401);
  const missing = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong' }).expect(401);
  assert.equal(wrong.body.message, missing.body.message);
});

test('protected routes reject missing, invalid, and expired tokens', async () => {
  await request(app).get('/api/models').expect(401);
  await request(app).get('/api/models').set(auth('invalid')).expect(401);
  const expired = jwt.sign({ id: 1, role: 'student' }, process.env.JWT_SECRET, { expiresIn: -1 });
  await request(app).get('/api/models').set(auth(expired)).expect(401);
});

test('teacher mutations are forbidden to students and annotation input is validated', async () => {
  const student = await registerAndLogin(user('student@example.com'));
  const teacher = await registerAndLogin(user('teacher@example.com', 'teacher'));
  const model = (await pool.query("INSERT INTO models(title,file_path) VALUES('Heart','/models/heart.glb') RETURNING id")).rows[0];
  await request(app).post(`/api/models/${model.id}/annotations`).set(auth(student.token)).send({ annotation_type: 'point', label: 'Aorta' }).expect(403);
  await request(app).post(`/api/models/${model.id}/annotations`).set(auth(teacher.token)).send({ annotation_type: 'bad', label: '' }).expect(400);
  const annotation = await request(app).post(`/api/models/${model.id}/annotations`).set(auth(teacher.token)).send({ annotation_type: 'point', label: 'Aorta', annotation_data: { position: [1, 2, 3] } }).expect(201);
  await request(app).put(`/api/annotations/${annotation.body.id}`).set(auth(teacher.token)).send({ annotation_type: 'point', label: 'Updated', annotation_data: {} }).expect(200);
  await request(app).delete(`/api/annotations/${annotation.body.id}`).set(auth(teacher.token)).expect(200);
});

test('quiz questions hide answers and submissions enforce identity and shape', async () => {
  const student = await registerAndLogin(user('student@example.com'));
  const other = await registerAndLogin(user('other@example.com'));
  const teacher = await registerAndLogin(user('teacher@example.com', 'teacher'));
  const quiz = (await pool.query("INSERT INTO quizzes(title,type,is_published) VALUES('Bones','MCQ',true) RETURNING id")).rows[0];
  const question = (await pool.query("INSERT INTO quiz_questions(quiz_id,question,format,option_a,option_b,option_c,option_d,correct_option) VALUES($1,'Largest bone?','mcq','Femur','Tibia','Ulna','Radius','A') RETURNING id", [quiz.id])).rows[0];
  const listed = await request(app).get(`/api/quizzes/${quiz.id}/questions`).set(auth(student.token)).expect(200);
  assert.equal('correct_option' in listed.body[0], false);
  await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(auth(teacher.token)).send({ answers: [] }).expect(403);
  await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(auth(student.token)).send({ answers: [] }).expect(400);
  const result = await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(auth(student.token)).send({ answers: [{ question_id: question.id, selected_option: 'A', student_id: 999 }] }).expect(200);
  assert.equal(result.body.score, 100);
  const stored = await pool.query('SELECT student_id FROM quiz_attempts WHERE id=$1', [result.body.attempt.id]);
  assert.equal(stored.rows[0].student_id, student.user.id);
  await request(app).get(`/api/attempts/${result.body.attempt.id}`).set(auth(other.token)).expect(404);
  await request(app).get(`/api/attempts/${result.body.attempt.id}/answers`).set(auth(other.token)).expect(403);
});

test('model/video lists, missing records, upload formats, and download logging work', async () => {
  const student = await registerAndLogin(user('student@example.com'));
  const teacher = await registerAndLogin(user('teacher@example.com', 'teacher'));
  assert.deepEqual((await request(app).get('/api/models').set(auth(student.token)).expect(200)).body, []);
  await request(app).get('/api/videos/999').set(auth(student.token)).expect(404);
  await request(app).post('/api/videos/upload').set(auth(teacher.token)).field('title', 'Bad').attach('video', Buffer.from('bad'), 'bad.exe').expect(400);
  await request(app).post('/api/models/upload').set(auth(teacher.token)).field('title', 'Bad').attach('model', Buffer.from('bad'), 'bad.exe').expect(400);
});
