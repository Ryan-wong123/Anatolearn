const { Pool } = require("pg");
require("dotenv").config();

if (process.env.NODE_ENV === "test") {
  const url = process.env.TEST_DATABASE_URL;
  let databaseName = "";
  try {
    databaseName = new URL(url).pathname.replace(/^\//, "");
  } catch {
    // The explicit error below is safer and more useful than a URL parser error.
  }
  if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL must identify a dedicated test database");
  }
  process.env.DATABASE_URL = url;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
