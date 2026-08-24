import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mock = require('mock-require');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'integration-test-secret';
const query = vi.fn();
mock('../src/db', { query });
const app = require('../src/server');

const studentToken = jwt.sign({ id: 7, role: 'student' }, process.env.JWT_SECRET);
const teacherToken = jwt.sign({ id: 9, role: 'teacher' }, process.env.JWT_SECRET);

describe('authentication and authorization', () => {
  beforeEach(() => query.mockReset());

  it('rejects missing, invalid, and expired tokens', async () => {
    expect((await request(app).get('/api/quizzes')).status).toBe(401);
    expect((await request(app).get('/api/quizzes').set('Authorization', 'Bearer invalid')).status).toBe(401);
    const expired = jwt.sign({ id: 7, role: 'student' }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await request(app).get('/api/quizzes').set('Authorization', `Bearer ${expired}`)).status).toBe(401);
  });

  it('validates registration input', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'Sam', email: 's@example.test', password: 'short', role: 'student' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/8 characters/);
  });

  it('rejects unknown login credentials without disclosing the account', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const response = await request(app).post('/api/auth/login').send({ email: 'none@example.test', password: 'password1' });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });
});

describe('quiz security and scoring', () => {
  beforeEach(() => query.mockReset());

  it('does not expose correct answers when retrieving questions', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, question: 'Q', option_a: 'A' }] });
    const response = await request(app).get('/api/quizzes/2/questions').set('Authorization', `Bearer ${studentToken}`);
    expect(response.status).toBe(200);
    expect(response.body[0]).not.toHaveProperty('correct_option');
    expect(query.mock.calls[0][0]).not.toMatch(/correct_option/i);
  });

  it('rejects incomplete and spoofed submissions before creating an attempt', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, format: 'mcq', correct_option: 'A' }, { id: 2, format: 'mcq', correct_option: 'B' }] });
    const response = await request(app).post('/api/quizzes/2/submit').set('Authorization', `Bearer ${studentToken}`).send({ student_id: 999, answers: [{ question_id: 1, selected_option: 'A' }] });
    expect(response.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('calculates score and attributes the attempt to the authenticated student', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1, format: 'mcq', correct_option: 'A' }, { id: 2, format: 'mcq', correct_option: 'B' }] })
      .mockResolvedValueOnce({ rows: [{ id: 44, student_id: 7, score: 50 }] })
      .mockResolvedValue({ rows: [] });
    const response = await request(app).post('/api/quizzes/2/submit').set('Authorization', `Bearer ${studentToken}`).send({ student_id: 999, answers: [{ question_id: 1, selected_option: 'A' }, { question_id: 2, selected_option: 'C' }] });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ score: 50, correct: 1, incorrect: 1 });
    expect(query.mock.calls[1][1][1]).toBe(7);
  });

  it('prevents one student from retrieving another student attempt', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const response = await request(app).get('/api/attempts/88').set('Authorization', `Bearer ${studentToken}`);
    expect(response.status).toBe(404);
    expect(query.mock.calls[0][1]).toEqual(['88', 'student', 7]);
  });
});

describe('annotation ownership', () => {
  beforeEach(() => query.mockReset());

  it('records the creator and scopes update/delete to that teacher', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 3, label: 'Aorta' }] });
    const created = await request(app).post('/api/models/1/annotations').set('Authorization', `Bearer ${teacherToken}`).send({ annotation_type: 'point', label: 'Aorta', annotation_data: {} });
    expect(created.status).toBe(201);
    expect(query.mock.calls[0][1].at(-1)).toBe(9);

    query.mockResolvedValueOnce({ rows: [] });
    const removed = await request(app).delete('/api/annotations/3').set('Authorization', `Bearer ${teacherToken}`);
    expect(removed.status).toBe(404);
    expect(query.mock.calls[1][1]).toEqual(['3', 9]);
  });
});
