const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const query = vi.fn();
const db = require("../src/db");
db.setPoolForTests({ query });
const app = require("../src/server");
const tokenFor = (id, role, options) => jwt.sign({ id, role }, process.env.JWT_SECRET, options);

beforeEach(() => query.mockReset());

describe("authentication boundaries", () => {
  it("registers a user and rejects a duplicate normalized email", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, email: "new@example.test", role: "student" }] });
    const created = await request(app).post("/api/auth/register").send({ name: "New Student", email: " New@Example.Test ", password: "password123", role: "student" });
    expect(created.status).toBe(201);
    expect(query.mock.calls[1][1][1]).toBe("new@example.test");

    query.mockReset();
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const duplicate = await request(app).post("/api/auth/register").send({ name: "Duplicate", email: "NEW@example.test", password: "password123", role: "student" });
    expect(duplicate.status).toBe(409);
  });

  it("returns a token for valid credentials and a generic failure for invalid login", async () => {
    const password_hash = await bcrypt.hash("password123", 4);
    query.mockResolvedValueOnce({ rows: [{ id: 7, name: "Student", email: "student@example.test", password_hash, role: "student", program_id: 1 }] });
    const valid = await request(app).post("/api/auth/login").send({ email: "student@example.test", password: "password123" });
    expect(valid.status).toBe(200);
    expect(jwt.verify(valid.body.token, process.env.JWT_SECRET).id).toBe(7);

    query.mockReset();
    query.mockResolvedValueOnce({ rows: [] });
    const invalid = await request(app).post("/api/auth/login").send({ email: "missing@example.test", password: "wrong-password" });
    expect(invalid.status).toBe(401);
    expect(invalid.body.message).toBe("Invalid email or password");
  });

  it("rejects missing, invalid, and expired tokens", async () => {
    expect((await request(app).get("/api/models")).status).toBe(401);
    expect((await request(app).get("/api/models").set("Authorization", "Bearer invalid")).status).toBe(401);
    const expired = tokenFor(1, "student", { expiresIn: -1 });
    expect((await request(app).get("/api/models").set("Authorization", `Bearer ${expired}`)).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps quiz answers confidential during retrieval", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 10, quiz_id: 2, question: "Q", format: "mcq", option_a: "A" }] });
    const response = await request(app).get("/api/quizzes/2/questions").set("Authorization", `Bearer ${tokenFor(7, "student")}`);
    expect(response.status).toBe(200);
    expect(response.body[0]).not.toHaveProperty("correct_option");
    expect(query.mock.calls[0][0]).not.toContain("correct_option");
  });
});

describe("quiz ownership and validation", () => {
  it("derives student_id from the token and rejects identity spoofing/incomplete answers", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 10, format: "mcq", correct_option: "A" }] });
    const response = await request(app)
      .post("/api/quizzes/2/submit")
      .set("Authorization", `Bearer ${tokenFor(7, "student")}`)
      .send({ student_id: 999, answers: [] });
    expect(response.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("prevents a student from reading another student's attempt", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 4, student_id: 8 }] });
    const response = await request(app).get("/api/attempts/4").set("Authorization", `Bearer ${tokenFor(7, "student")}`);
    expect(response.status).toBe(403);
  });
});

describe("annotation and media validation", () => {
  it("rejects malformed annotations before querying the database", async () => {
    const response = await request(app)
      .post("/api/models/1/annotations")
      .set("Authorization", `Bearer ${tokenFor(2, "teacher")}`)
      .send({ annotation_type: "script", label: "" });
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects unsupported model and video uploads", async () => {
    const auth = `Bearer ${tokenFor(2, "teacher")}`;
    const model = await request(app).post("/api/models/upload").set("Authorization", auth).attach("model", Buffer.from("x"), "bad.exe");
    const video = await request(app).post("/api/videos/upload").set("Authorization", auth).attach("video", Buffer.from("x"), "bad.txt");
    expect(model.status).toBeGreaterThanOrEqual(400);
    expect(video.status).toBeGreaterThanOrEqual(400);
    expect(query).not.toHaveBeenCalled();
  });
});
