const fs = require("fs");
const os = require("os");
const path = require("path");
const { Pool } = require("pg");
const { requireTestDatabaseUrl } = require("./testDatabase");

module.exports = async () => {
  const connectionString = requireTestDatabaseUrl();
  process.env.DATABASE_URL = connectionString;
  const pool = new Pool({ connectionString });
  const sqlDir = path.join(__dirname, "../../sql");
  // 001 predates a DROP for this enum; remove it so repeated test runs are
  // deterministic while leaving the production migration unchanged.
  await pool.query("DROP TYPE IF EXISTS quiz_type CASCADE");
  for (const filename of ["001_schema.sql", "002_seed.sql", "003_add_users.sql", "004_add_model_fields_and_downloads.sql", "005_add_quiz_attempt_student_id.sql", "006_add_video_annotation_link.sql"]) {
    await pool.query(fs.readFileSync(path.join(sqlDir, filename), "utf8"));
  }
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "anatolearn-test-"));
  fs.writeFileSync(path.join(publicDir, "test-public-dir"), "owned by integration tests");
  process.env.PUBLIC_DIR = publicDir;
  fs.writeFileSync(path.join(__dirname, ".public-dir"), publicDir);
  await pool.end();
};
