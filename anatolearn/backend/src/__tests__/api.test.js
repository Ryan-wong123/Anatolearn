const request = require('supertest');
const jwt = require('jsonwebtoken');
const { beforeAll, describe, expect, it } = require('vitest');
const app = require('../server');
const pool = require('../db');

let studentToken;
let otherToken;
let teacherToken;
let quizId;
let questionId;
let modelId;

async function register(email, role) {
  return request(app).post('/api/auth/register').send({ name: email, email, password: 'password123', role });
}

async function login(email) {
  const response = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return response.body.token;
}

beforeAll(async () => {
  await register('student@example.test', 'student');
  await register('other@example.test', 'student');
  await register('teacher@example.test', 'teacher');
  studentToken = await login('student@example.test');
  otherToken = await login('other@example.test');
  teacherToken = await login('teacher@example.test');
  const quiz = await pool.query("INSERT INTO quizzes(title,type,is_published) VALUES ('Deterministic quiz','MCQ',true) RETURNING id");
  quizId = quiz.rows[0].id;
  const question = await pool.query("INSERT INTO quiz_questions(quiz_id,question,format,option_a,option_b,option_c,option_d,correct_option) VALUES ($1,'Which chamber?','mcq','A','B','C','D','B') RETURNING id", [quizId]);
  questionId = question.rows[0].id;
  const model = await pool.query("INSERT INTO models(title,file_path,is_published) VALUES ('Heart','/models/anatomy/heart.glb',true) RETURNING id");
  modelId = model.rows[0].id;
});

describe('authentication and authorization', () => {
  it('registers, normalizes email, and rejects a duplicate', async () => {
    const created = await register(' NEW@EXAMPLE.TEST ', 'student');
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty('password_hash');
    expect((await register('new@example.test', 'student')).status).toBe(409);
  });

  it('uses the same failure for unknown emails and wrong passwords', async () => {
    for (const body of [{ email: 'missing@example.test', password: 'password123' }, { email: 'student@example.test', password: 'wrongpass' }]) {
      const response = await request(app).post('/api/auth/login').send(body);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password');
    }
  });

  it('rejects missing, invalid, expired, and forbidden credentials', async () => {
    expect((await request(app).get('/api/models')).status).toBe(401);
    expect((await request(app).get('/api/models').set('Authorization', 'Bearer invalid')).status).toBe(401);
    const expired = jwt.sign({ id: 1, role: 'student' }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await request(app).get('/api/models').set('Authorization', `Bearer ${expired}`)).status).toBe(401);
    expect((await request(app).delete(`/api/models/${modelId}`).set('Authorization', `Bearer ${studentToken}`)).status).toBe(403);
  });
});

describe('quiz confidentiality, scoring, and ownership', () => {
  it('retrieves questions without answer keys and scores a valid submission', async () => {
    const questions = await request(app).get(`/api/quizzes/${quizId}/questions`).set('Authorization', `Bearer ${studentToken}`);
    expect(questions.body[0]).not.toHaveProperty('correct_option');
    const result = await request(app).post(`/api/quizzes/${quizId}/submit`).set('Authorization', `Bearer ${studentToken}`).send({ answers: [{ question_id: questionId, selected_option: 'B' }] });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ score: 100, correct: 1, total: 1 });
    const attemptId = result.body.attempt.id;
    expect((await request(app).get(`/api/attempts/${attemptId}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(403);
    const ownAnswers = await request(app).get(`/api/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`);
    expect(ownAnswers.body[0]).not.toHaveProperty('correct_option');
  });

  it('rejects malformed, incomplete, spoofed, and teacher submissions', async () => {
    expect((await request(app).post(`/api/quizzes/${quizId}/submit`).set('Authorization', `Bearer ${studentToken}`).send({ answers: 'bad' })).status).toBe(400);
    expect((await request(app).post(`/api/quizzes/${quizId}/submit`).set('Authorization', `Bearer ${studentToken}`).send({ student_id: 999, answers: [] })).status).toBe(400);
    expect((await request(app).post(`/api/quizzes/${quizId}/submit`).set('Authorization', `Bearer ${teacherToken}`).send({ answers: [] })).status).toBe(403);
  });
});

describe('annotations, listings, and uploads', () => {
  it('validates annotation payloads and enforces teacher operations', async () => {
    const endpoint = `/api/models/${modelId}/annotations`;
    expect((await request(app).post(endpoint).set('Authorization', `Bearer ${studentToken}`).send({})).status).toBe(403);
    expect((await request(app).post(endpoint).set('Authorization', `Bearer ${teacherToken}`).send({ annotation_type: 'bad', label: '', annotation_data: [] })).status).toBe(400);
    const created = await request(app).post(endpoint).set('Authorization', `Bearer ${teacherToken}`).send({ annotation_type: 'point', label: 'Aorta', annotation_data: { position: [1, 2, 3] } });
    expect(created.status).toBe(201);
    expect((await request(app).get(endpoint).set('Authorization', `Bearer ${studentToken}`)).body).toHaveLength(1);
    expect((await request(app).delete(`/api/annotations/${created.body.id}`).set('Authorization', `Bearer ${teacherToken}`)).status).toBe(200);
  });

  it('lists records, reports missing records, and rejects invalid media', async () => {
    expect((await request(app).get('/api/models').set('Authorization', `Bearer ${studentToken}`)).body).toHaveLength(1);
    expect((await request(app).get('/api/videos').set('Authorization', `Bearer ${studentToken}`)).body).toEqual([]);
    expect((await request(app).get('/api/videos/99999').set('Authorization', `Bearer ${studentToken}`)).status).toBe(404);
    const invalid = await request(app).post('/api/videos/upload').set('Authorization', `Bearer ${teacherToken}`).field('title', 'Invalid').attach('video', Buffer.from('not video'), 'payload.exe');
    expect(invalid.status).toBeGreaterThanOrEqual(400);
  });
});
