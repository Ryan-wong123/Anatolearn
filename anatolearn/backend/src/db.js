const { Pool } = require("pg");
require("dotenv").config();

let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (...args) => pool.query(...args),
  // Deliberately test-only dependency injection; production code never calls this.
  setPoolForTests: (testPool) => {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("setPoolForTests is only available in NODE_ENV=test");
    }
    pool = testPool;
  },
};
