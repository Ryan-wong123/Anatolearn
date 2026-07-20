const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const pool = require("./db");
const multer = require("multer");

const app = express();

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const videosDir = path.join(
      process.env.PUBLIC_DIR || path.join(__dirname, "../../public"),
      "videos"
    );
    fs.mkdir(videosDir, { recursive: true })
      .then(() => cb(null, videosDir))
      .catch((err) => cb(err, videosDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `video-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const allowed = [".mp4", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .mp4 and .webm files are allowed"));
    }
  },
});

const modelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const modelsDir = path.join(
      process.env.PUBLIC_DIR || path.join(__dirname, "../../public"),
      "models/anatomy"
    );
    fs.mkdir(modelsDir, { recursive: true })
      .then(() => cb(null, modelsDir))
      .catch((err) => cb(err, modelsDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `model-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const uploadModel = multer({
  storage: modelStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const allowed = [".glb", ".gltf", ".obj"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .glb, .gltf, and .obj files are allowed"));
    }
  },
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(process.env.PUBLIC_DIR || path.join(__dirname, "../../public")));

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", db_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/programs", async (req, res) => {
  const result = await pool.query("SELECT * FROM programs ORDER BY id");
  res.json(result.rows);
});

app.get("/api/models", async (req, res) => {
  const { published } = req.query;

  if (published === "true") {
    const result = await pool.query(
      "SELECT * FROM models WHERE is_published = true ORDER BY id"
    );
    return res.json(result.rows);
  }

  const result = await pool.query("SELECT * FROM models ORDER BY id");
  res.json(result.rows);
});

app.get("/api/models/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM models WHERE id = $1", [
    req.params.id,
  ]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Model not found" });
  }

  res.json(result.rows[0]);
});

app.post("/api/models/upload", uploadModel.single("model"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No model file uploaded" });
    }

    const { title, description, program_id } = req.body;

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const filePath = `/models/anatomy/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO models (title, description, file_path, program_id, is_published)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [title, description || null, filePath, program_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to upload model:", err);
    res.status(500).json({ message: err.message || "Failed to upload model" });
  }
});

app.delete("/api/models/:id", async (req, res) => {
  const result = await pool.query(
    "DELETE FROM models WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Model not found" });
  }

  res.json({ message: "Model deleted" });
});

app.patch("/api/models/:id/publish", async (req, res) => {
  const { is_published } = req.body;

  const result = await pool.query(
    `UPDATE models SET is_published = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [is_published, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Model not found" });
  }

  res.json(result.rows[0]);
});

app.put("/api/models/:id", async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ message: "title is required" });
  }

  const result = await pool.query(
    `UPDATE models SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
    [title, description || null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Model not found" });
  }

  res.json(result.rows[0]);
});

app.patch("/api/models/:id/thumbnail", async (req, res) => {
  try {
    const { thumbnailDataUrl } = req.body;

    if (!thumbnailDataUrl) {
      return res.status(400).json({ message: "Missing thumbnail data" });
    }

    const base64Data = thumbnailDataUrl.replace(/^data:image\/png;base64,/, "");

    const thumbnailsDir = path.join(
      process.env.PUBLIC_DIR || path.join(__dirname, "../../public"),
      "thumbnails"
    );
    await fs.mkdir(thumbnailsDir, { recursive: true });

    const filename = `model-${req.params.id}.png`;
    const filePath = path.join(thumbnailsDir, filename);

    await fs.writeFile(filePath, base64Data, "base64");

    const publicPath = `/thumbnails/${filename}`;

    const result = await pool.query(
      `UPDATE models
       SET thumbnail_path = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [publicPath, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Model not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to save thumbnail:", err);
    res.status(500).json({ message: "Failed to save thumbnail" });
  }
});

app.get("/api/models/:id/annotations", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM annotations WHERE model_id = $1 ORDER BY id",
    [req.params.id]
  );

  res.json(result.rows);
});

app.post("/api/models/:id/annotations", async (req, res) => {
  const { annotation_type, label, description, color, annotation_data } = req.body;

  const result = await pool.query(
    `INSERT INTO annotations 
      (model_id, annotation_type, label, description, color, annotation_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      req.params.id,
      annotation_type,
      label,
      description || null,
      color || null,
      annotation_data || {},
    ]
  );

  res.status(201).json(result.rows[0]);
});

app.delete("/api/annotations/:id", async (req, res) => {
  const result = await pool.query(
    "DELETE FROM annotations WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Annotation not found" });
  }

  res.json({ message: "Annotation deleted" });
});

app.put("/api/annotations/:id", async (req, res) => {
  const { annotation_type, label, description, color, annotation_data } = req.body;

  const result = await pool.query(
    `UPDATE annotations
     SET annotation_type = $1,
         label = $2,
         description = $3,
         color = $4,
         annotation_data = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING *`,
    [annotation_type, label, description || null, color || null, annotation_data || {}, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Annotation not found" });
  }

  res.json(result.rows[0]);
});

app.get("/api/videos", async (req, res) => {
  const { published } = req.query;

  if (published === "true") {
    const result = await pool.query(
      "SELECT * FROM videos WHERE is_published = true ORDER BY id"
    );
    return res.json(result.rows);
  }

  const result = await pool.query("SELECT * FROM videos ORDER BY id");
  res.json(result.rows);
});

app.get("/api/videos/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM videos WHERE id = $1", [
    req.params.id,
  ]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.json(result.rows[0]);
});

app.post("/api/videos/upload", uploadVideo.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    const { title, description, program_id } = req.body;

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const videoPath = `/videos/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO videos (title, description, video_path, program_id, is_published)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [title, description || null, videoPath, program_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to upload video:", err);
    res.status(500).json({ message: err.message || "Failed to upload video" });
  }
});

app.delete("/api/videos/:id", async (req, res) => {
  const result = await pool.query(
    "DELETE FROM videos WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.json({ message: "Video deleted" });
});

app.patch("/api/videos/:id/publish", async (req, res) => {
  const { is_published } = req.body;

  const result = await pool.query(
    `UPDATE videos SET is_published = $1 WHERE id = $2 RETURNING *`,
    [is_published, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.json(result.rows[0]);
});

app.put("/api/videos/:id", async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ message: "title is required" });
  }

  const result = await pool.query(
    `UPDATE videos SET title = $1, description = $2 WHERE id = $3 RETURNING *`,
    [title, description || null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.json(result.rows[0]);
});

app.get("/api/quizzes", async (req, res) => {
  const { published } = req.query;

  if (published === "true") {
    const result = await pool.query(
      "SELECT * FROM quizzes WHERE is_published = true ORDER BY id"
    );
    return res.json(result.rows);
  }

  const result = await pool.query("SELECT * FROM quizzes ORDER BY id");
  res.json(result.rows);
});

app.get("/api/quizzes/:id/questions", async (req, res) => {
  const result = await pool.query(
    "SELECT id, quiz_id, question, format, option_a, option_b, option_c, option_d FROM quiz_questions WHERE quiz_id = $1 ORDER BY id",
    [req.params.id]
  );

  res.json(result.rows);
});

app.post("/api/quizzes/:id/submit", async (req, res) => {
  const { answers } = req.body;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: "answers must be an array" });
  }

  try {
    const questionsResult = await pool.query(
      "SELECT id, format, correct_option FROM quiz_questions WHERE quiz_id = $1",
      [req.params.id]
    );

    const questionMap = {};
    questionsResult.rows.forEach((q) => {
      questionMap[q.id] = q;
    });

    const total = questionsResult.rows.length;
    let correctCount = 0;
    let mcqCount = 0;
    let hasOpenEnded = false;

    const gradedAnswers = answers.map(({ question_id, selected_option, answer_text }) => {
      const q = questionMap[question_id];

      if (!q) {
        return { question_id, selected_option: selected_option || null, answer_text: answer_text || null, is_correct: null };
      }

      if (q.format === "mcq") {
        mcqCount++;
        const isCorrect = q.correct_option === selected_option;
        if (isCorrect) correctCount++;
        return { question_id, selected_option: selected_option || null, answer_text: null, is_correct: isCorrect };
      } else {
        hasOpenEnded = true;
        return { question_id, selected_option: null, answer_text: answer_text || null, is_correct: null };
      }
    });

    const status = hasOpenEnded ? "pending_review" : "graded";
    const score = status === "graded" && total > 0 ? Math.round((correctCount / total) * 100) : null;

    const attemptResult = await pool.query(
      `INSERT INTO quiz_attempts (quiz_id, score, total_questions, correct_count, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, score, total, status === "graded" ? correctCount : null, status]
    );

    const attempt = attemptResult.rows[0];

    for (const ans of gradedAnswers) {
      await pool.query(
        `INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_option, answer_text, is_correct)
         VALUES ($1, $2, $3, $4, $5)`,
        [attempt.id, ans.question_id, ans.selected_option, ans.answer_text, ans.is_correct]
      );
    }

    const feedback = gradedAnswers
      .filter((a) => questionMap[a.question_id]?.format === "mcq")
      .map((a) => ({
        question_id: a.question_id,
        selected_option: a.selected_option,
        correct_option: questionMap[a.question_id].correct_option,
        is_correct: a.is_correct,
      }));

    res.json({
      attempt,
      status,
      score,
      total,
      correct: status === "graded" ? correctCount : null,
      incorrect: status === "graded" ? total - correctCount : null,
      mcq_count: mcqCount,
      open_ended_count: total - mcqCount,
      feedback,
    });
  } catch (err) {
    console.error("Failed to submit quiz:", err);
    res.status(500).json({ message: "Failed to submit quiz" });
  }
});

app.post("/api/quizzes", async (req, res) => {
  const { title, description, type, category, program_id } = req.body;

  if (!title || !type) {
    return res.status(400).json({ message: "title and type are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO quizzes (title, description, type, category, program_id, is_published)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING *`,
      [title, description || null, type, category || null, program_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to create quiz:", err);
    res.status(500).json({ message: "Failed to create quiz" });
  }
});

app.post("/api/quizzes/:id/questions", async (req, res) => {
  const { question, format, option_a, option_b, option_c, option_d, correct_option, model_answer } = req.body;

  if (!question) {
    return res.status(400).json({ message: "question is required" });
  }

  const questionFormat = format === "open_ended" ? "open_ended" : "mcq";

  if (questionFormat === "mcq") {
    if (!option_a || !option_b || !option_c || !option_d || !correct_option) {
      return res.status(400).json({ message: "MCQ questions require all 4 options and a correct_option" });
    }
    if (!["A", "B", "C", "D"].includes(correct_option)) {
      return res.status(400).json({ message: "correct_option must be A, B, C, or D" });
    }
  } else {
    if (!model_answer) {
      return res.status(400).json({ message: "Open-ended questions require a model_answer" });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO quiz_questions
        (quiz_id, question, format, option_a, option_b, option_c, option_d, correct_option, model_answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.params.id,
        question,
        questionFormat,
        questionFormat === "mcq" ? option_a : null,
        questionFormat === "mcq" ? option_b : null,
        questionFormat === "mcq" ? option_c : null,
        questionFormat === "mcq" ? option_d : null,
        questionFormat === "mcq" ? correct_option : null,
        questionFormat === "open_ended" ? model_answer : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to create question:", err);
    res.status(500).json({ message: "Failed to create question" });
  }
});

app.put("/api/quizzes/:id", async (req, res) => {
  const { title, description, category } = req.body;

  if (!title) {
    return res.status(400).json({ message: "title is required" });
  }

  const result = await pool.query(
    `UPDATE quizzes SET title = $1, description = $2, category = $3 WHERE id = $4 RETURNING *`,
    [title, description || null, category || null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  res.json(result.rows[0]);
});

app.delete("/api/quizzes/:id", async (req, res) => {
  const result = await pool.query(
    "DELETE FROM quizzes WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  res.json({ message: "Quiz deleted" });
});

app.patch("/api/quizzes/:id/type", async (req, res) => {
  const { type } = req.body;

  if (!["MCQ", "Practical", "Mixed"].includes(type)) {
    return res.status(400).json({ message: "type must be MCQ, Practical, or Mixed" });
  }

  const result = await pool.query(
    `UPDATE quizzes SET type = $1 WHERE id = $2 RETURNING *`,
    [type, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  res.json(result.rows[0]);
});

app.patch("/api/quizzes/:id/publish", async (req, res) => {
  const { is_published } = req.body;

  const result = await pool.query(
    `UPDATE quizzes SET is_published = $1 WHERE id = $2 RETURNING *`,
    [is_published, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  res.json(result.rows[0]);
});

app.get("/api/quizzes/:id/attempts/pending", async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND status = 'pending_review' ORDER BY attempted_at`,
    [req.params.id]
  );
  res.json(result.rows);
});

app.get("/api/attempts/:id/answers", async (req, res) => {
  const result = await pool.query(
    `SELECT qaa.*, qq.question, qq.format, qq.model_answer, qq.correct_option
     FROM quiz_attempt_answers qaa
     JOIN quiz_questions qq ON qq.id = qaa.question_id
     WHERE qaa.attempt_id = $1
     ORDER BY qaa.id`,
    [req.params.id]
  );
  res.json(result.rows);
});

app.get("/api/attempts/:id", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM quiz_attempts WHERE id = $1",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Attempt not found" });
  }

  res.json(result.rows[0]);
});

app.patch("/api/attempt-answers/:id/grade", async (req, res) => {
  const { teacher_score } = req.body;

  if (typeof teacher_score !== "number" || teacher_score < 0 || teacher_score > 100) {
    return res.status(400).json({ message: "teacher_score must be a number between 0 and 100" });
  }

  try {
    const updateResult = await pool.query(
      `UPDATE quiz_attempt_answers SET teacher_score = $1, is_correct = $2 WHERE id = $3 RETURNING *`,
      [teacher_score, teacher_score >= 50, req.params.id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: "Answer not found" });
    }

    const answer = updateResult.rows[0];

    const allAnswers = await pool.query(
      `SELECT qaa.*, qq.format
       FROM quiz_attempt_answers qaa
       JOIN quiz_questions qq ON qq.id = qaa.question_id
       WHERE qaa.attempt_id = $1`,
      [answer.attempt_id]
    );

    const stillPending = allAnswers.rows.some(
      (a) => a.format === "open_ended" && a.teacher_score === null
    );

    if (!stillPending) {
      const mcqCorrect = allAnswers.rows.filter((a) => a.format === "mcq" && a.is_correct).length;
      const mcqCount = allAnswers.rows.filter((a) => a.format === "mcq").length;
      const openEndedTotal = allAnswers.rows
        .filter((a) => a.format === "open_ended")
        .reduce((sum, a) => sum + (a.teacher_score || 0), 0);
      const openEndedCount = allAnswers.rows.filter((a) => a.format === "open_ended").length;
      const totalQuestions = allAnswers.rows.length;

      const mcqPercent = mcqCount > 0 ? (mcqCorrect / mcqCount) * 100 : 0;
      const openEndedPercent = openEndedCount > 0 ? openEndedTotal / openEndedCount : 0;
      const openEndedWeight = totalQuestions > 0 ? openEndedCount / totalQuestions : 0;
      const mcqWeight = 1 - openEndedWeight;

      const finalScore = Math.round(mcqPercent * mcqWeight + openEndedPercent * openEndedWeight);

      await pool.query(
        `UPDATE quiz_attempts SET score = $1, correct_count = $2, status = 'graded' WHERE id = $3`,
        [finalScore, mcqCorrect, answer.attempt_id]
      );
    }

    res.json(answer);
  } catch (err) {
    console.error("Failed to grade answer:", err);
    res.status(500).json({ message: "Failed to grade answer" });
  }
});

app.delete("/api/questions/:id", async (req, res) => {
  const result = await pool.query(
    "DELETE FROM quiz_questions WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json({ message: "Question deleted" });
});

app.put("/api/questions/:id", async (req, res) => {
  const { question, format, option_a, option_b, option_c, option_d, correct_option, model_answer } = req.body;

  if (!question) {
    return res.status(400).json({ message: "question is required" });
  }

  const questionFormat = format === "open_ended" ? "open_ended" : "mcq";

  if (questionFormat === "mcq") {
    if (!option_a || !option_b || !option_c || !option_d || !correct_option) {
      return res.status(400).json({ message: "MCQ questions require all 4 options and a correct_option" });
    }
    if (!["A", "B", "C", "D"].includes(correct_option)) {
      return res.status(400).json({ message: "correct_option must be A, B, C, or D" });
    }
  } else {
    if (!model_answer) {
      return res.status(400).json({ message: "Open-ended questions require a model_answer" });
    }
  }

  try {
    const result = await pool.query(
      `UPDATE quiz_questions
       SET question = $1, format = $2, option_a = $3, option_b = $4, option_c = $5, option_d = $6, correct_option = $7, model_answer = $8
       WHERE id = $9
       RETURNING *`,
      [
        question,
        questionFormat,
        questionFormat === "mcq" ? option_a : null,
        questionFormat === "mcq" ? option_b : null,
        questionFormat === "mcq" ? option_c : null,
        questionFormat === "mcq" ? option_d : null,
        questionFormat === "mcq" ? correct_option : null,
        questionFormat === "open_ended" ? model_answer : null,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update question:", err);
    res.status(500).json({ message: "Failed to update question" });
  }
});

app.get("/api/resources", async (req, res) => {
  const { published } = req.query;

  if (published === "true") {
    const result = await pool.query(
      "SELECT * FROM resources WHERE is_published = true ORDER BY id"
    );
    return res.json(result.rows);
  }

  const result = await pool.query("SELECT * FROM resources ORDER BY id");
  res.json(result.rows);
});

const resourceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const resourcesDir = path.join(
      process.env.PUBLIC_DIR || path.join(__dirname, "../../public"),
      "resources"
    );
    fs.mkdir(resourcesDir, { recursive: true })
      .then(() => cb(null, resourcesDir))
      .catch((err) => cb(err, resourcesDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `resource-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const uploadResource = multer({
  storage: resourceStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .pdf, .doc, and .docx files are allowed"));
    }
  },
});

app.post("/api/resources/upload", uploadResource.single("file"), async (req, res) => {
  try {
    const { title, description, resource_type, url, program_id } = req.body;

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }
    if (!resource_type || !["pdf", "document", "link"].includes(resource_type)) {
      return res.status(400).json({ message: "resource_type must be pdf, document, or link" });
    }

    let filePath;
    if (resource_type === "link") {
      if (!url) {
        return res.status(400).json({ message: "url is required for link resources" });
      }
      filePath = url;
    } else {
      if (!req.file) {
        return res.status(400).json({ message: "file is required for pdf/document resources" });
      }
      filePath = `/resources/${req.file.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO resources (title, description, resource_type, file_path, program_id, is_published)
   VALUES ($1, $2, $3, $4, $5, false)
   RETURNING *`,
      [title, description || null, resource_type, filePath, program_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to upload resource:", err);
    res.status(500).json({ message: err.message || "Failed to upload resource" });
  }
});

app.delete("/api/resources/:id", async (req, res) => {
  const result = await pool.query(
    "DELETE FROM resources WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Resource not found" });
  }

  res.json({ message: "Resource deleted" });
});

app.patch("/api/resources/:id/publish", async (req, res) => {
  const { is_published } = req.body;

  const result = await pool.query(
    `UPDATE resources SET is_published = $1 WHERE id = $2 RETURNING *`,
    [is_published, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Resource not found" });
  }

  res.json(result.rows[0]);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`AnatoLearn backend running on port ${PORT}`);
});