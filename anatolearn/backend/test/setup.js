import { afterEach, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-for-production';
const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgres://anatolearn:anatolearn@localhost:5432/anatolearn_test';
if (!/(_test|test_)/i.test(testDatabaseUrl)) {
  throw new Error('Backend tests refuse TEST_DATABASE_URL unless its database name contains "test".');
}
process.env.DATABASE_URL = testDatabaseUrl;

afterEach(() => vi.restoreAllMocks());
