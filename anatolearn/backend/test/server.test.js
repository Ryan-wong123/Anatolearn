const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');

describe('authentication middleware', () => {
  it.each(['/api/models', '/api/videos', '/api/quizzes'])('rejects a missing token for %s', async (route) => {
    const response = await request(app).get(route);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required' });
  });

  it('rejects an invalid token', async () => {
    const response = await request(app).get('/api/models').set('Authorization', 'Bearer invalid');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign({ id: 1, role: 'student' }, process.env.JWT_SECRET, { expiresIn: -1 });
    const response = await request(app).get('/api/models').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  it('does not grant teacher routes to a student identity', async () => {
    const token = jwt.sign({ id: 1, role: 'student' }, process.env.JWT_SECRET);
    const response = await request(app).delete('/api/models/1').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});
