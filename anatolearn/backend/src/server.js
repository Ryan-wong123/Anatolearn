const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const pool = require("./db");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

// exposedHeaders is required for the browser's fetch() to see
// Content-Disposition across origins (frontend:5173 -> backend:5000) —
// without it, the real filename from res.download()/annotation export is
// invisible to client-side JS and downloads silently fall back to a
// generic name. Not caught by curl-based testing since CORS is a
// browser-only enforcement, only surfaced once tested in a real browser.
app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
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

const VALID_ROLES = ["student", "teacher"];

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    "WARNING: JWT_SECRET is not set. /api/auth/login will fail until it's provided " +
      "(see docker-compose.yml's backend.environment block)."
  );
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireTeacher(req, res, next) {
  if (!req.user || req.user.role !== "teacher") {
    return res.status(403).json({ message: "Teacher access required" });
  }
  next();
}

// Learning-home summary. Identity and programme scope come exclusively from
// the verified JWT; clients cannot request another student's activity.
app.get("/api/dashboard/summary", authenticate, async (req, res) => {
  try {
    const isStudent = req.user.role === "student";
    const attemptsPromise = isStudent
      ? pool.query(
          `SELECT qa.id, qa.quiz_id, q.title AS quiz_title, qa.score, qa.status, qa.attempted_at
           FROM quiz_attempts qa
           JOIN quizzes q ON q.id = qa.quiz_id
           WHERE qa.student_id = $1
           ORDER BY qa.attempted_at DESC
           LIMIT 5`,
          [req.user.id]
        )
      : Promise.resolve({ rows: [] });
    const quizStatsPromise = isStudent
      ? pool.query(
          `SELECT COUNT(DISTINCT quiz_id)::int AS quizzes_completed,
                  ROUND(AVG(score))::int AS average_quiz_score
           FROM quiz_attempts WHERE student_id = $1`,
          [req.user.id]
        )
      : Promise.resolve({ rows: [{ quizzes_completed: null, average_quiz_score: null }] });
    const contentParams = req.user.program_id ? [req.user.program_id] : [];
    const programmeClause = req.user.program_id
      ? "AND (program_id = $1 OR program_id IS NULL)"
      : "";
    const featuredPromise = pool.query(
      `SELECT id, title, description, content_type
       FROM (
         SELECT id, title, description, 'model' AS content_type, created_at
         FROM models WHERE is_published = true ${programmeClause}
         UNION ALL
         SELECT id, title, description, 'video' AS content_type, created_at
         FROM videos WHERE is_published = true ${programmeClause}
       ) featured_content
       ORDER BY created_at DESC LIMIT 1`,
      contentParams
    );
    const [attemptsResult, quizStatsResult, featuredResult] = await Promise.all([
      attemptsPromise, quizStatsPromise, featuredPromise,
    ]);
    const featured = featuredResult.rows[0] || null;
    const latestAttempt = attemptsResult.rows[0] || null;
    const quizStats = quizStatsResult.rows[0];

    res.json({
      progress: {
        quizzes_completed: quizStats.quizzes_completed,
        average_quiz_score: quizStats.average_quiz_score,
        // No watch/exploration event tables exist. Null means unavailable,
        // rather than misleadingly presenting zero activity.
        videos_watched: null,
        models_explored: null,
      },
      recent_attempts: attemptsResult.rows,
      continue_learning: latestAttempt
        ? {
            title: latestAttempt.quiz_title,
            description: latestAttempt.status === "pending_review"
              ? "Your latest quiz is awaiting review. Browse another assessment while you wait."
              : `Review your latest quiz result${latestAttempt.score == null ? "" : ` (${latestAttempt.score}%)`}.`,
            path: "/quizzes",
            action_label: "Continue with quizzes",
          }
        : featured
          ? {
              title: featured.title,
              description: "Start with this featured learning resource.",
              path: featured.content_type === "model" ? `/3dviewer/${featured.id}` : `/videos/${featured.id}`,
              action_label: featured.content_type === "model" ? "Explore model" : "Watch video",
            }
          : null,
      featured: featured
        ? { ...featured, path: featured.content_type === "model" ? `/3dviewer/${featured.id}` : `/videos/${featured.id}` }
        : null,
    });
  } catch (err) {
    console.error("Failed to load dashboard summary:", err);
    res.status(500).json({ message: "Failed to load dashboard summary" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, program_id } = req.body;

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "name, email, password, and role are required" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ message: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "password must be at least 8 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      normalizedEmail,
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, program_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, program_id, created_at`,
      [name, normalizedEmail, passwordHash, role, program_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to register user:", err);
    res.status(500).json({ message: err.message || "Failed to register user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ message: "Server is missing JWT_SECRET configuration" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      "SELECT id, name, email, password_hash, role, program_id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    // Same generic message whether the email doesn't exist or the password is wrong —
    // don't reveal which one it was, that would let someone enumerate registered emails.
    const invalidCredentials = () =>
      res.status(401).json({ message: "Invalid email or password" });

    if (result.rows.length === 0) {
      return invalidCredentials();
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return invalidCredentials();
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, program_id: user.program_id },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        program_id: user.program_id,
      },
    });
  } catch (err) {
    console.error("Failed to log in:", err);
    res.status(500).json({ message: err.message || "Failed to log in" });
  }
});

app.get("/api/models", authenticate, async (req, res) => {
  const { published, system, part, q } = req.query;

  const conditions = [];
  const values = [];

  if (published === "true") {
    conditions.push("is_published = true");
  }
  if (system) {
    values.push(system);
    conditions.push(`body_system = $${values.length}`);
  }
  if (part) {
    values.push(part);
    conditions.push(`body_part = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT * FROM models ${whereClause} ORDER BY id`,
    values
  );
  res.json(result.rows);
});

app.get("/api/models/:id", authenticate, async (req, res) => {
  const result = await pool.query("SELECT * FROM models WHERE id = $1", [
    req.params.id,
  ]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Model not found" });
  }

  res.json(result.rows[0]);
});

app.post("/api/models/upload", authenticate, requireTeacher, uploadModel.single("model"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No model file uploaded" });
    }

    const { title, description, program_id, body_system, body_part } = req.body;

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const filePath = `/models/anatomy/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO models (title, description, file_path, program_id, body_system, body_part, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [title, description || null, filePath, program_id || null, body_system || null, body_part || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to upload model:", err);
    res.status(500).json({ message: err.message || "Failed to upload model" });
  }
});

app.delete("/api/models/:id", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM models WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Model not found" });
  }

  res.json({ message: "Model deleted" });
});

app.patch("/api/models/:id/publish", authenticate, requireTeacher, async (req, res) => {
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

app.patch(
  "/api/models/:id/neutral-view",
  authenticate,
  requireTeacher,
  async (req, res) => {
    try {
      const { cameraPosition, target } = req.body;

      const isValidPoint = (point) =>
        point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.z);

      if (
        !isValidPoint(cameraPosition) ||
        !isValidPoint(target)
      ) {
        return res.status(400).json({
          message:
            "cameraPosition and target must contain valid x, y, and z values",
        });
      }

      const neutralView = {
        cameraPosition,
        target,
      };

      const result = await pool.query(
        `UPDATE models
         SET neutral_view = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [
          JSON.stringify(neutralView),
          req.params.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Model not found",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(
        "Failed to save neutral view:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to save neutral view",
      });
    }
  }
);

app.put("/api/models/:id", authenticate, requireTeacher, async (req, res) => {
  const { title, description, body_system, body_part } = req.body;

  if (!title) {
    return res.status(400).json({ message: "title is required" });
  }

  const result = await pool.query(
    `UPDATE models SET title = $1, description = $2, body_system = $3, body_part = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`,
    [title, description || null, body_system || null, body_part || null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Model not found" });
  }

  res.json(result.rows[0]);
});

app.get("/api/models/:id/download", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM models WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Model not found" });
    }
    const model = result.rows[0];

    // Teachers can download any model; students only published ones.
    if (req.user.role !== "teacher" && !model.is_published) {
      return res.status(403).json({ message: "This model is not available for download" });
    }

    const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "../../public");
    const absolutePath = path.join(publicDir, model.file_path);
    const ext = path.extname(model.file_path);
    const safeTitle = model.title.replace(/[^a-z0-9_-]+/gi, "_");
    const downloadName = `${safeTitle}${ext}`;

    // Best-effort logging — a failed insert shouldn't block the actual download.
    try {
      await pool.query(
        "INSERT INTO downloads (model_id, downloaded_by) VALUES ($1, $2)",
        [model.id, req.user.id]
      );
    } catch (logErr) {
      console.error("Failed to log download (continuing anyway):", logErr);
    }

    res.download(absolutePath, downloadName, (err) => {
      if (err && !res.headersSent) {
        console.error("Failed to send model file:", err);
        res.status(500).json({ message: "Failed to download model file" });
      }
    });
  } catch (err) {
    console.error("Failed to process download:", err);
    res.status(500).json({ message: err.message || "Failed to download model" });
  }
});

app.patch("/api/models/:id/thumbnail", authenticate, async (req, res) => {
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

app.get("/api/models/:id/annotations", authenticate, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM annotations WHERE model_id = $1 ORDER BY id",
    [req.params.id]
  );

  res.json(result.rows);
});

// Task 10.2 — exports from `annotations`, not a `labels` table (see
// docs/database_schema.md for why). Route path uses /annotations/export
// rather than the originally-specified /labels/export to match the real
// data model.
app.get("/api/models/:id/annotations/export", authenticate, requireTeacher, async (req, res) => {
  try {
    const format = req.query.format === "csv" ? "csv" : "json";

    const result = await pool.query(
      `SELECT id, annotation_type, label, description, color, annotation_data, created_at
       FROM annotations WHERE model_id = $1 ORDER BY id`,
      [req.params.id]
    );

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="model-${req.params.id}-annotations.json"`);
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify(result.rows, null, 2));
    }

    // CSV: common fields are flattened into columns; annotation_data (which
    // varies by annotation_type — point/highlight/region) is stringified
    // into its own column rather than split out, since a single flat
    // schema doesn't fit all three annotation shapes cleanly.
    const escapeCsv = (value) => {
      if (value === null || value === undefined) return "";
      const str =
        value instanceof Date
          ? value.toISOString()
          : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const header = "id,annotation_type,label,description,color,annotation_data,created_at";
    const rows = result.rows.map((r) =>
      [r.id, r.annotation_type, r.label, r.description, r.color, r.annotation_data, r.created_at]
        .map(escapeCsv)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Disposition", `attachment; filename="model-${req.params.id}-annotations.csv"`);
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  } catch (err) {
    console.error("Failed to export annotations:", err);
    res.status(500).json({ message: err.message || "Failed to export annotations" });
  }
});

app.post("/api/models/:id/annotations", authenticate, requireTeacher, async (req, res) => {
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

app.delete("/api/annotations/:id", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM annotations WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Annotation not found" });
  }

  res.json({ message: "Annotation deleted" });
});

app.put("/api/annotations/:id", authenticate, requireTeacher, async (req, res) => {
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

app.get("/api/videos", authenticate, async (req, res) => {
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

// Task 7.6 — list every annotation across every model, with its model's
// title joined in, so the video edit form can offer a meaningful picker
// ("Aortic Valve — Heart Cross Section") rather than a bare list of ids.
// Teacher-only: this is only ever used from the video edit form.
app.get("/api/annotations", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    `SELECT a.id, a.label, a.annotation_type, m.title AS model_title
     FROM annotations a
     JOIN models m ON m.id = a.model_id
     ORDER BY m.title, a.label`
  );
  res.json(result.rows);
});

app.get("/api/videos/:id", authenticate, async (req, res) => {
  const result = await pool.query("SELECT * FROM videos WHERE id = $1", [
    req.params.id,
  ]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.json(result.rows[0]);
});

app.post("/api/videos/upload", authenticate, requireTeacher, uploadVideo.single("video"), async (req, res) => {
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

app.delete("/api/videos/:id", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM videos WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.json({ message: "Video deleted" });
});

app.patch("/api/videos/:id/publish", authenticate, requireTeacher, async (req, res) => {
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

app.put("/api/videos/:id", authenticate, requireTeacher, async (req, res) => {
  const { title, description, annotation_id } = req.body;

  if (!title) {
    return res.status(400).json({ message: "title is required" });
  }

  const result = await pool.query(
    `UPDATE videos SET title = $1, description = $2, annotation_id = $3 WHERE id = $4 RETURNING *`,
    [title, description || null, annotation_id || null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.json(result.rows[0]);
});

app.get("/api/quizzes", authenticate, async (req, res) => {
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

app.get("/api/quizzes/:id/questions", authenticate, async (req, res) => {
  const result = await pool.query(
    "SELECT id, quiz_id, question, format, option_a, option_b, option_c, option_d FROM quiz_questions WHERE quiz_id = $1 ORDER BY id",
    [req.params.id]
  );

  res.json(result.rows);
});

app.post("/api/quizzes/:id/submit", authenticate, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students can submit quiz attempts" });
  }
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
      `INSERT INTO quiz_attempts (quiz_id, student_id, score, total_questions, correct_count, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.params.id, req.user.id, score, total, status === "graded" ? correctCount : null, status]
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

app.post("/api/quizzes", authenticate, requireTeacher, async (req, res) => {
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

app.post("/api/quizzes/:id/questions", authenticate, requireTeacher, async (req, res) => {
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

app.put("/api/quizzes/:id", authenticate, requireTeacher, async (req, res) => {
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

app.delete("/api/quizzes/:id", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM quizzes WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  res.json({ message: "Quiz deleted" });
});

app.patch("/api/quizzes/:id/type", authenticate, requireTeacher, async (req, res) => {
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

app.patch("/api/quizzes/:id/publish", authenticate, requireTeacher, async (req, res) => {
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

app.get("/api/quizzes/:id/attempts/pending", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND status = 'pending_review' ORDER BY attempted_at`,
    [req.params.id]
  );
  res.json(result.rows);
});

// Task 8.8 — real student attempt history, now possible since auth exists.
// Scoped to req.user.id, not a :studentId param, so a student can only ever
// see their own attempts — there's no way to pass someone else's id here.
app.get("/api/students/me/attempts", authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT qa.id, qa.quiz_id, q.title AS quiz_title, qa.score, qa.status, qa.attempted_at
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.student_id = $1
     ORDER BY qa.attempted_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

app.get("/api/attempts/:id/answers", authenticate, async (req, res) => {
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

app.get("/api/attempts/:id", authenticate, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM quiz_attempts WHERE id = $1",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Attempt not found" });
  }

  res.json(result.rows[0]);
});

app.patch("/api/attempt-answers/:id/grade", authenticate, requireTeacher, async (req, res) => {
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

app.delete("/api/questions/:id", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM quiz_questions WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json({ message: "Question deleted" });
});

app.put("/api/questions/:id", authenticate, requireTeacher, async (req, res) => {
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

app.get("/api/resources", authenticate, async (req, res) => {
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

app.post("/api/resources/upload", authenticate, requireTeacher, uploadResource.single("file"), async (req, res) => {
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

app.delete("/api/resources/:id", authenticate, requireTeacher, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM resources WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Resource not found" });
  }

  res.json({ message: "Resource deleted" });
});

app.patch("/api/resources/:id/publish", authenticate, requireTeacher, async (req, res) => {
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
