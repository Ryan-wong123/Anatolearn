const { requireTestDatabaseUrl } = require("./testDatabase");
const fs = require("fs");
const path = require("path");
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.JWT_SECRET = "integration-test-secret-not-for-production";
const marker = path.join(__dirname, ".public-dir");
if (fs.existsSync(marker)) process.env.PUBLIC_DIR = fs.readFileSync(marker, "utf8");
