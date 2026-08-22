const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { requireTestDatabaseUrl } = require("./testDatabase");

module.exports = async () => {
  const pool = new Pool({ connectionString: requireTestDatabaseUrl() });
  await pool.query("TRUNCATE users, downloads, quiz_attempt_answers, quiz_attempts, quiz_questions, quizzes, videos, annotations, models RESTART IDENTITY CASCADE");
  await pool.end();
  const marker = path.join(__dirname, ".public-dir");
  if (fs.existsSync(marker)) {
    const publicDir = fs.readFileSync(marker, "utf8");
    if (publicDir.startsWith(require("os").tmpdir()) && fs.existsSync(path.join(publicDir, "test-public-dir"))) {
      fs.rmSync(publicDir, { recursive: true, force: true });
    }
    fs.rmSync(marker, { force: true });
  }
};
