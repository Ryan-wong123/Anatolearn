const { URL } = require("url");

function requireTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error("TEST_DATABASE_URL is required (for example postgresql://localhost/anatolearn_test)");
  }
  const parsed = new URL(value);
  const database = parsed.pathname.slice(1);
  const localHost = ["localhost", "127.0.0.1", "postgres"].includes(parsed.hostname);
  if (!localHost || !/(^|[_-])test($|[_-])/.test(database)) {
    throw new Error("Refusing to run: TEST_DATABASE_URL must target a local database whose name contains 'test'");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value && process.env.ALLOW_TEST_DATABASE_RESET !== "true") {
    throw new Error("Refusing to run: TEST_DATABASE_URL matches DATABASE_URL");
  }
  return value;
}

module.exports = { requireTestDatabaseUrl };
