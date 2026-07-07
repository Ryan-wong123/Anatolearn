const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

app.get("/api/quizzes", async (req, res) => {
  const result = await pool.query("SELECT * FROM quizzes ORDER BY id");
  res.json(result.rows);
});

app.get("/api/quizzes/:id/questions", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY id",
    [req.params.id]
  );

  res.json(result.rows);
});

app.get("/api/resources", async (req, res) => {
  const result = await pool.query("SELECT * FROM resources ORDER BY id");
  res.json(result.rows);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`AnatoLearn backend running on port ${PORT}`);
});