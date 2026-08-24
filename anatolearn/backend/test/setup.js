process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "anatolearn-deterministic-test-secret";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://localhost/anatolearn_test";

if (!/(^|[/_-])test([/?_-]|$)/i.test(process.env.DATABASE_URL)) {
  throw new Error("Backend tests refuse database URLs that are not clearly marked as test databases");
}
