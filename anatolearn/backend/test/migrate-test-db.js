const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !/(^|[/_-])test([/?_-]|$)/i.test(databaseUrl)) {
  throw new Error("Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'");
}

(async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (let number = 1; number <= 6; number += 1) {
      const prefix = String(number).padStart(3, "0");
      const filename = fs.readdirSync(path.join(__dirname, "../sql")).find((entry) => entry.startsWith(`${prefix}_`));
      await client.query(fs.readFileSync(path.join(__dirname, "../sql", filename), "utf8"));
    }
  } finally {
    await client.end();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
