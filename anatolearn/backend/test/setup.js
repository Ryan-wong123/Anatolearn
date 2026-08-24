process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'anatolearn-test-secret-not-for-production';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.slice(1).toLowerCase();
  if (!/(^|[_-])test($|[_-])/.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL must name a database containing a standalone test segment');
  }
  process.env.DATABASE_URL = databaseUrl;
}

