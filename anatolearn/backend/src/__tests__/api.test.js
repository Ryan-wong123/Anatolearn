const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");
const pool = require("../db");

const password = "Anatomy123!";
const auth = (token) => ({ Authorization: `Bearer ${token}` });
let student;
let otherStudent;
let teacher;

async function register(name, email, role) {
  const response = await request(app).post("/api/auth/register").send({ name, email, password, role });
  expect(response.status).toBe(201);
  const login = await request(app).post("/api/auth/login").send({ email, password });
  return { ...response.body, token: login.body.token };
}

beforeAll(async () => {
  await pool.query("TRUNCATE users, downloads, quiz_attempt_answers, quiz_attempts, quiz_questions, quizzes, videos, annotations, models RESTART IDENTITY CASCADE");
  student = await register("Student One", "student@example.test", "student");
  otherStudent = await register("Student Two", "other@example.test", "student");
  teacher = await register("Teacher", "teacher@example.test", "teacher");
});
afterAll(() => pool.end());

describe("authentication and authorization", () => {
  test("registers normalized email and rejects duplicates", async () => {
    const duplicate = await request(app).post("/api/auth/register").send({ name: "Duplicate", email: " STUDENT@example.test ", password, role: "student" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ message: expect.stringMatching(/already exists/) });
  });

  test.each([
    [{ email: "missing@example.test", password }, 401],
    [{ email: "student@example.test", password: "wrong-password" }, 401],
    [{ email: "student@example.test" }, 400],
  ])("rejects failed login %#", async (body, status) => {
    const response = await request(app).post("/api/auth/login").send(body);
    expect(response.status).toBe(status);
    expect(response.body).not.toHaveProperty("token");
  });

  test("rejects missing, invalid, and expired tokens", async () => {
    expect((await request(app).get("/api/models")).status).toBe(401);
    expect((await request(app).get("/api/models").set(auth("invalid"))).status).toBe(401);
    const expired = jwt.sign({ id: student.id, role: "student" }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await request(app).get("/api/models").set(auth(expired))).status).toBe(401);
  });

  test("enforces teacher operations", async () => {
    const forbidden = await request(app).post("/api/quizzes").set(auth(student.token)).send({ title: "No", type: "MCQ" });
    expect(forbidden.status).toBe(403);
    const allowed = await request(app).post("/api/quizzes").set(auth(teacher.token)).send({ title: "Anatomy", type: "MCQ" });
    expect(allowed.status).toBe(201);
  });
});

describe("quizzes and attempt ownership", () => {
  let quizId;
  let questionId;
  let attemptId;
  beforeAll(async () => {
    const quiz = await request(app).post("/api/quizzes").set(auth(teacher.token)).send({ title: "Cardiac", type: "MCQ" });
    quizId = quiz.body.id;
    const question = await request(app).post(`/api/quizzes/${quizId}/questions`).set(auth(teacher.token)).send({ question: "Which chamber pumps systemically?", format: "mcq", option_a: "RA", option_b: "RV", option_c: "LA", option_d: "LV", correct_option: "D" });
    questionId = question.body.id;
  });

  test("does not expose answers during retrieval and validates submissions", async () => {
    const questions = await request(app).get(`/api/quizzes/${quizId}/questions`).set(auth(student.token));
    expect(questions.status).toBe(200);
    expect(questions.body[0]).not.toHaveProperty("correct_option");
    expect((await request(app).post(`/api/quizzes/${quizId}/submit`).set(auth(student.token)).send({ answers: "D" })).status).toBe(400);
    expect((await request(app).post(`/api/quizzes/${quizId}/submit`).set(auth(student.token)).send({ answers: [] })).status).toBe(400);
  });

  test("scores a valid attempt for the authenticated student only", async () => {
    const response = await request(app).post(`/api/quizzes/${quizId}/submit`).set(auth(student.token)).send({ student_id: otherStudent.id, answers: [{ question_id: questionId, selected_option: "D" }] });
    expect(response.status).toBe(200);
    expect(response.body.score).toBe(100);
    expect(response.body.attempt.student_id).toBe(student.id);
    attemptId = response.body.attempt.id;
  });

  test("blocks cross-user attempts and withholds answer keys from their owner", async () => {
    expect((await request(app).get(`/api/attempts/${attemptId}`).set(auth(otherStudent.token))).status).toBe(403);
    expect((await request(app).get(`/api/attempts/${attemptId}/answers`).set(auth(otherStudent.token))).status).toBe(403);
    const own = await request(app).get(`/api/attempts/${attemptId}/answers`).set(auth(student.token));
    expect(own.status).toBe(200);
    expect(own.body[0]).not.toHaveProperty("correct_option");
    const reviewed = await request(app).get(`/api/attempts/${attemptId}/answers`).set(auth(teacher.token));
    expect(reviewed.body[0].correct_option).toBe("D");
  });
});

describe("models, annotations, and videos", () => {
  let modelId;
  let annotationId;
  beforeAll(async () => {
    const model = await pool.query("INSERT INTO models (title, file_path, is_published) VALUES ('Heart', '/models/anatomy/heart.glb', true) RETURNING id");
    modelId = model.rows[0].id;
  });

  test("lists models, returns missing records, and rejects student annotation creation", async () => {
    expect((await request(app).get("/api/models").set(auth(student.token))).body).toHaveLength(1);
    expect((await request(app).get("/api/models/99999").set(auth(student.token))).status).toBe(404);
    expect((await request(app).post(`/api/models/${modelId}/annotations`).set(auth(student.token)).send({})).status).toBe(403);
  });

  test("validates and supports teacher annotation CRUD", async () => {
    const invalid = await request(app).post(`/api/models/${modelId}/annotations`).set(auth(teacher.token)).send({ annotation_type: "bad", label: "X", annotation_data: {} });
    expect(invalid.status).toBe(400);
    const created = await request(app).post(`/api/models/${modelId}/annotations`).set(auth(teacher.token)).send({ annotation_type: "point", label: "Aorta", annotation_data: { position: [1, 2, 3] } });
    expect(created.status).toBe(201);
    annotationId = created.body.id;
    const updated = await request(app).put(`/api/annotations/${annotationId}`).set(auth(teacher.token)).send({ annotation_type: "highlight", label: "Ascending aorta", annotation_data: { triangles: [1] } });
    expect(updated.status).toBe(200);
    expect((await request(app).delete(`/api/annotations/${annotationId}`).set(auth(student.token))).status).toBe(403);
    expect((await request(app).delete(`/api/annotations/${annotationId}`).set(auth(teacher.token))).status).toBe(200);
  });

  test("returns empty videos and rejects unsupported uploads safely", async () => {
    const videos = await request(app).get("/api/videos").set(auth(student.token));
    expect(videos.status).toBe(200);
    expect(videos.body).toEqual([]);
    const upload = await request(app).post("/api/videos/upload").set(auth(teacher.token)).field("title", "Bad media").attach("video", Buffer.from("text"), "bad.txt");
    expect(upload.status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get("/api/videos/99999").set(auth(student.token))).status).toBe(404);
  });
});
