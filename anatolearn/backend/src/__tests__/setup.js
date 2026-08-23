const fs = require('fs');
const path = require('path');
const { beforeAll, afterAll } = require('vitest');

let databaseName = '';
try {
  databaseName = new URL(process.env.TEST_DATABASE_URL).pathname.replace(/^\//, '');
} catch {
  // Report the same actionable safety error for absent and malformed URLs.
}
if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
  throw new Error('Refusing integration tests: set TEST_DATABASE_URL to a dedicated database whose name contains "test"');
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
const pool = require('../db');

beforeAll(async () => {
  await pool.query('DROP TABLE IF EXISTS users, downloads CASCADE');
  for (let number = 1; number <= 6; number += 1) {
    const prefix = String(number).padStart(3, '0');
    const filename = fs.readdirSync(path.join(__dirname, '../../sql')).find((name) => name.startsWith(prefix));
    await pool.query(fs.readFileSync(path.join(__dirname, '../../sql', filename), 'utf8'));
  }
});

afterAll(async () => {
  await pool.query('TRUNCATE users, quiz_attempt_answers, quiz_attempts, quiz_questions, quizzes, annotations, videos, downloads, models RESTART IDENTITY CASCADE');
  await pool.end();
});
