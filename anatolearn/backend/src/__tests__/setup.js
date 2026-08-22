process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'anatolearn-test-only-secret';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PUBLIC_DIR = process.env.PUBLIC_DIR || '/tmp/anatolearn-api-tests';
