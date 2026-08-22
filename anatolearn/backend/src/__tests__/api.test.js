const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const app = require('../server');
const pool = require('../db');

const student = { name: 'Fixture Student', email: 'student.fixture@example.test', password: 'TestPass123!', role: 'student', program_id: 1 };
const teacher = { name: 'Fixture Teacher', email: 'teacher.fixture@example.test', password: 'TestPass123!', role: 'teacher', program_id: 1 };

async function registerAndLogin(user) {
  await request(app).post('/api/auth/register').send(user).expect(201);
  const response = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password }).expect(200);
  return response.body;
}

describe.sequential('AnatoLearn API', () => {
  let studentAuth;
  let otherStudentAuth;
  let teacherAuth;

  beforeEach(async () => {
    await pool.query('TRUNCATE quiz_attempt_answers, quiz_attempts, downloads, users, annotations RESTART IDENTITY CASCADE');
    studentAuth = await registerAndLogin(student);
    otherStudentAuth = await registerAndLogin({ ...student, name: 'Other Student', email: 'other.fixture@example.test' });
    teacherAuth = await registerAndLogin(teacher);
  });

  afterAll(async () => {
    await fs.rm(process.env.PUBLIC_DIR, { recursive: true, force: true });
    await pool.end();
  });

  it('registers deterministically and rejects duplicate email and invalid credentials', async () => {
    await request(app).post('/api/auth/register').send({ ...student, email: student.email.toUpperCase() }).expect(409);
    await request(app).post('/api/auth/login').send({ email: student.email, password: 'wrong-password' }).expect(401, { message: 'Invalid email or password' });
  });

  it('rejects missing, invalid, and expired tokens', async () => {
    await request(app).get('/api/models').expect(401);
    await request(app).get('/api/models').set('Authorization', 'Bearer invalid').expect(401);
    const expired = jwt.sign({ id: studentAuth.user.id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: -1 });
    await request(app).get('/api/models').set('Authorization', `Bearer ${expired}`).expect(401);
  });

  it('enforces teacher operations and annotation validation', async () => {
    await request(app).post('/api/models/1/annotations').set('Authorization', `Bearer ${studentAuth.token}`).send({}).expect(403);
    await request(app).post('/api/models/1/annotations').set('Authorization', `Bearer ${teacherAuth.token}`).send({ annotation_type: 'bad', label: '', annotation_data: [] }).expect(400);
    const created = await request(app).post('/api/models/1/annotations').set('Authorization', `Bearer ${teacherAuth.token}`).send({ annotation_type: 'point', label: 'Fixture landmark', annotation_data: { position: [0, 0, 0] } }).expect(201);
    await request(app).put(`/api/annotations/${created.body.id}`).set('Authorization', `Bearer ${teacherAuth.token}`).send({ annotation_type: 'point', label: 'Updated landmark', annotation_data: { position: [1, 0, 0] } }).expect(200);
    await request(app).delete(`/api/annotations/${created.body.id}`).set('Authorization', `Bearer ${teacherAuth.token}`).expect(200);
  });

  it('keeps quiz answers confidential, scores valid work, and rejects malformed submissions', async () => {
    const questions = await request(app).get('/api/quizzes/1/questions').set('Authorization', `Bearer ${studentAuth.token}`).expect(200);
    expect(questions.body[0]).not.toHaveProperty('correct_option');
    const answers = questions.body.map((question) => ({ question_id: question.id, selected_option: 'B' }));
    await request(app).post('/api/quizzes/1/submit').set('Authorization', `Bearer ${teacherAuth.token}`).send({ answers }).expect(403);
    await request(app).post('/api/quizzes/1/submit').set('Authorization', `Bearer ${studentAuth.token}`).send({ answers: 'spoofed' }).expect(400);
    await request(app).post('/api/quizzes/1/submit').set('Authorization', `Bearer ${studentAuth.token}`).send({ answers: [answers[0]] }).expect(400);
    const result = await request(app).post('/api/quizzes/1/submit').set('Authorization', `Bearer ${studentAuth.token}`).send({ student_id: otherStudentAuth.user.id, answers }).expect(200);
    expect(result.body).toMatchObject({ score: 67, total: 3, correct: 2 });
    expect(result.body.attempt.student_id).toBe(studentAuth.user.id);

    await request(app).get(`/api/attempts/${result.body.attempt.id}`).set('Authorization', `Bearer ${otherStudentAuth.token}`).expect(403);
    const ownAnswers = await request(app).get(`/api/attempts/${result.body.attempt.id}/answers`).set('Authorization', `Bearer ${studentAuth.token}`).expect(200);
    expect(ownAnswers.body[0]).not.toHaveProperty('model_answer');
  });

  it('lists models and videos, handles missing records, validates uploads, and counts downloads', async () => {
    await request(app).get('/api/models?published=true').set('Authorization', `Bearer ${studentAuth.token}`).expect(200);
    await request(app).get('/api/videos?published=true').set('Authorization', `Bearer ${studentAuth.token}`).expect(200);
    await request(app).get('/api/models/99999').set('Authorization', `Bearer ${studentAuth.token}`).expect(404);
    await request(app).get('/api/videos/99999').set('Authorization', `Bearer ${studentAuth.token}`).expect(404);
    await request(app).post('/api/models/upload').set('Authorization', `Bearer ${teacherAuth.token}`).field('title', 'Invalid model').attach('model', Buffer.from('bad'), 'bad.exe').expect(400);
    const model = await request(app).post('/api/models/upload').set('Authorization', `Bearer ${teacherAuth.token}`).field('title', 'Download fixture').attach('model', Buffer.from('fixture glb'), 'fixture.glb').expect(201);
    await request(app).patch(`/api/models/${model.body.id}/publish`).set('Authorization', `Bearer ${teacherAuth.token}`).send({ is_published: true }).expect(200);
    await request(app).get(`/api/models/${model.body.id}/download`).set('Authorization', `Bearer ${studentAuth.token}`).expect(200);
    const downloads = await pool.query('SELECT downloaded_by FROM downloads WHERE model_id = $1', [model.body.id]);
    expect(downloads.rows).toEqual([{ downloaded_by: studentAuth.user.id }]);
  });
});
