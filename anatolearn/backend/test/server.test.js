import { createRequire } from 'node:module';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = 'test-only-secret-not-for-production';
const pool = require('../src/db.js');
const app = require('../src/server.js');

const tokenFor = (id, role = 'student', options) =>
  jwt.sign({ id, name: `Fixture ${id}`, role, program_id: 1 }, process.env.JWT_SECRET, options);

beforeEach(() => vi.spyOn(pool, 'query').mockResolvedValue({ rows: [] }));

describe('authentication and authorization contracts', () => {
  it('rejects missing, malformed, and expired tokens', async () => {
    await request(app).get('/api/models').expect(401, { message: 'Authentication required' });
    await request(app).get('/api/models').set('Authorization', 'Bearer malformed').expect(401);
    await request(app).get('/api/models').set('Authorization', `Bearer ${tokenFor(1, 'student', { expiresIn: -1 })}`).expect(401);
  });

  it('returns a token for valid login and rejects invalid login', async () => {
    const user = { id: 1, name: 'Student', email: 'student@test.invalid', password_hash: bcrypt.hashSync('TestPass123!', 4), role: 'student', program_id: 1 };
    pool.query.mockResolvedValueOnce({ rows: [user] }).mockResolvedValueOnce({ rows: [user] });
    const success = await request(app).post('/api/auth/login').send({ email: 'STUDENT@test.invalid ', password: 'TestPass123!' }).expect(200);
    expect(success.body.token).toEqual(expect.any(String));
    await request(app).post('/api/auth/login').send({ email: 'student@test.invalid', password: 'wrong' }).expect(401, { message: 'Invalid email or password' });
  });

  it('registers a normalized account and reports duplicate email', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 4, name: 'New Student', email: 'new@test.invalid', role: 'student', program_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 4 }] });
    await request(app).post('/api/auth/register').send({ name: 'New Student', email: ' NEW@test.invalid ', password: 'TestPass123!', role: 'student', program_id: 1 }).expect(201);
    await request(app).post('/api/auth/register').send({ name: 'Again', email: 'new@test.invalid', password: 'TestPass123!', role: 'student' }).expect(409);
  });

  it('prevents students from creating annotations', async () => {
    await request(app).post('/api/models/1/annotations')
      .set('Authorization', `Bearer ${tokenFor(1)}`)
      .send({ annotation_type: 'point', label: 'Aorta', annotation_data: {} })
      .expect(403, { message: 'Teacher access required' });
  });

  it('enforces attempt ownership', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 9, student_id: 2 }] });
    await request(app).get('/api/attempts/9')
      .set('Authorization', `Bearer ${tokenFor(1)}`)
      .expect(403, { message: 'You may only view your own attempts' });
  });
});

describe('media and annotation validation', () => {
  it('returns missing records and empty lists deterministically', async () => {
    await request(app).get('/api/models').set('Authorization', `Bearer ${tokenFor(1)}`).expect(200, []);
    await request(app).get('/api/videos/404').set('Authorization', `Bearer ${tokenFor(1)}`).expect(404, { message: 'Video not found' });
  });

  it('rejects unsupported model and video uploads', async () => {
    const teacher = `Bearer ${tokenFor(3, 'teacher')}`;
    await request(app).post('/api/models/upload').set('Authorization', teacher).attach('model', Buffer.from('bad'), 'model.exe').expect(400);
    await request(app).post('/api/videos/upload').set('Authorization', teacher).attach('video', Buffer.from('bad'), 'video.txt').expect(400);
  });

  it('validates annotation payloads before database mutation', async () => {
    await request(app).post('/api/models/1/annotations')
      .set('Authorization', `Bearer ${tokenFor(3, 'teacher')}`)
      .send({ annotation_type: 'point', label: '   ', annotation_data: {} })
      .expect(400, { message: 'label is required' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('quiz validation and confidentiality', () => {
  it('rejects identity spoofing and incomplete submissions before inserting', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 11, format: 'mcq', correct_option: 'A' }] });
    await request(app).post('/api/quizzes/3/submit')
      .set('Authorization', `Bearer ${tokenFor(7)}`)
      .send({ student_id: 999, answers: [] })
      .expect(400);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('does not expose correct answers in the questions endpoint', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 11, quiz_id: 3, question: 'Q?', format: 'mcq', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D' }] });
    const response = await request(app).get('/api/quizzes/3/questions')
      .set('Authorization', `Bearer ${tokenFor(7)}`)
      .expect(200);
    expect(response.body[0]).not.toHaveProperty('correct_option');
    expect(response.body[0]).not.toHaveProperty('model_answer');
  });
});
