# API Endpoints

Base URL (local dev): `http://localhost:5000/api`

No authentication exists yet (Task 9 not built) — all endpoints below are currently open, unauthenticated.

**Static files:** as of 15 Jul 2026, `express.static` serves `PUBLIC_DIR` (`/public` in the container) directly — any `video_path`, `thumbnail_path`, or model `file_path` stored in the database is reachable at that exact URL path (e.g. `video_path: "/videos/s.mp4"` → `http://localhost:5000/videos/s.mp4`). This was previously broken (files existed on disk but had no route serving them) — see `docs/database_schema.md` for the bug writeup.

---

## Health

### `GET /api/health`
Returns `{ status: "ok", db_time: <timestamp> }` if the database connection is alive.

---

## Programs

### `GET /api/programs`
Returns all programs.

---

## Models

### `GET /api/models`
Returns all models.

### `GET /api/models/:id`
Returns a single model. 404 if not found.

### `PATCH /api/models/:id/thumbnail`
Body: `{ thumbnailDataUrl: string }` (base64 PNG data URL). Saves a thumbnail image to disk and updates `thumbnail_path`. 400 if missing data, 404 if model not found. Called automatically by `Viewer.tsx` the first time a model is opened and has no existing thumbnail.

**Note:** models have no `is_published` column and no upload/delete/update endpoints — unlike videos and quizzes, there is currently no way to add a new model or manage visibility through the API at all (Tasks 2.6, 4.5, 4.6, 6.2/6.3 model-publish portions remain unbuilt).

---

## Annotations

Powers the full `Viewer.tsx` 3D interaction system — point markers, freehand draw highlights, and filled surface regions. Confirmed working end-to-end as of 15 Jul 2026.

### `GET /api/models/:id/annotations`
Returns all annotations for a model.

### `POST /api/models/:id/annotations`
Body: `{ annotation_type: 'point' | 'highlight' | 'region_fill', label, description?, color?, annotation_data? }`. Creates an annotation.

### `PUT /api/annotations/:id`
Same body shape as POST. Updates an annotation. 404 if not found.

### `DELETE /api/annotations/:id`
Deletes an annotation. 404 if not found.

---

## Videos

### `GET /api/videos`
Returns videos. Optional query param `?published=true` filters to `is_published = true` only (added 15 Jul 2026, matches the same pattern as quizzes). No server-side `?category=` or `?q=` filtering exists — search in `Videos.tsx` is done entirely client-side against the already-loaded list, and there's no `category` column on `videos` at all.

### `GET /api/videos/:id`
Returns a single video. 404 if not found.

### `POST /api/videos/upload` (added 15 Jul 2026)
Multipart form upload (`multipart/form-data`, not JSON). Fields: `video` (file, required — `.mp4`/`.webm` only, 200MB limit), `title` (required), `description` (optional), `program_id` (optional). Saves the file to `PUBLIC_DIR/videos/` with a generated unique filename (`video-<timestamp>.<ext>`), creates a `videos` row with `is_published: false`. Returns the created video record. 400 if no file, wrong format, or missing title.

### `DELETE /api/videos/:id` (added 15 Jul 2026)
Deletes a video's database row. 404 if not found. **Does not delete the underlying file from disk** — only removes the database record. Worth flagging as a known gap if disk space becomes a concern.

### `PATCH /api/videos/:id/publish` (added 15 Jul 2026)
Body: `{ is_published: boolean }`. Toggles publish state, same pattern as the quiz equivalent. 404 if not found.

### `PUT /api/videos/:id` (added 15 Jul 2026)
Body: `{ title, description? }`. Updates a video's metadata. Does not support changing the video file itself or `program_id`. 400 if `title` missing, 404 if not found.

---

## Quizzes

**Known limitation — student result visibility:** since there's no auth (`student_id` doesn't exist on `quiz_attempts`), the frontend uses a same-browser `sessionStorage` workaround to let a student see their result after a teacher grades it: the attempt id is stored in `sessionStorage` keyed by quiz id after submission, and `handleStartQuiz` checks for it before starting a fresh attempt. This only works on the same browser/device the student originally submitted from — it is NOT real quiz history and does not survive a cleared cache, a different device, or a different user opening the app. Real fix is Task 9 (auth) + `student_id` column, still blocked.

### `GET /api/quizzes`
Returns quizzes. Optional query param `?published=true` filters to `is_published = true` only (used for the student view — there is no auth to enforce this server-side yet, it relies on the frontend passing the right param).

### `POST /api/quizzes`
Body: `{ title, description?, type: 'MCQ'|'Practical'|'Mixed', category?, program_id? }`. Creates a quiz with `is_published: false`. 400 if `title` or `type` missing. In practice, the frontend always sends `type: 'MCQ'` here as a placeholder and overwrites it later via `PATCH /api/quizzes/:id/type` once the real question formats are known.

### `DELETE /api/quizzes/:id`
Deletes a quiz. Cascades to delete its `quiz_questions`, `quiz_attempts`, and (via `quiz_attempts`) `quiz_attempt_answers`. 404 if not found.

### `PATCH /api/quizzes/:id/publish`
Body: `{ is_published: boolean }`. Toggles publish state. 404 if not found.

### `PATCH /api/quizzes/:id/type`
Body: `{ type: 'MCQ'|'Practical'|'Mixed' }`. Updates a quiz's type label. Called by the frontend right before publishing, with a type auto-derived from the actual question formats present in the quiz — not manually chosen by the teacher. 400 if `type` is not one of the three valid values.

### `GET /api/quizzes/:id/questions`
Returns questions for a quiz. **Excludes `correct_option` and `model_answer`** — neither the MCQ answer key nor the open-ended reference answer is visible to students before submitting.

### `POST /api/quizzes/:id/questions`
Body: `{ question, format: 'mcq'|'open_ended', option_a?, option_b?, option_c?, option_d?, correct_option?, model_answer? }`. For `format: 'mcq'`, all 4 options and `correct_option` are required. For `format: 'open_ended'`, `model_answer` is required instead. 400 if the required fields for the given format are missing, or if `correct_option` isn't A/B/C/D.

### `PUT /api/questions/:id`
Same body shape and validation as POST. Updates a question, including switching its format (e.g. MCQ → open-ended).

### `DELETE /api/questions/:id`
Deletes a question. 404 if not found.

### `POST /api/quizzes/:id/submit`
Body: `{ answers: [{ question_id, selected_option? , answer_text? }] }` — send `selected_option` for MCQ questions, `answer_text` for open-ended ones (per answer). Grades MCQ answers immediately server-side; stores every individual answer (MCQ and open-ended) in `quiz_attempt_answers`. If the quiz contains any open-ended questions, the attempt is marked `pending_review` and `score`/`correct`/`incorrect` are returned as `null` until a teacher grades every open-ended answer. Returns:

```json
{
  "attempt": { "id", "quiz_id", "score", "total_questions", "correct_count", "status", "attempted_at" },
  "status": "graded" | "pending_review",
  "score": "number | null",
  "total": "number",
  "correct": "number | null",
  "incorrect": "number | null",
  "mcq_count": "number",
  "open_ended_count": "number",
  "feedback": [
    { "question_id": "number", "selected_option": "string", "correct_option": "string", "is_correct": "boolean" }
  ]
}
```

`feedback` only includes MCQ questions — open-ended answers have no automated feedback. 400 if `answers` is not an array.

**Known gap:** no `student_id` is recorded (no auth yet), so attempts can't be tied to a specific student. Quiz history (Task 8.8) is blocked on this. See the sessionStorage workaround note above for the interim, single-browser stopgap.

### `GET /api/quizzes/:id/attempts/pending`
Returns all attempts for a quiz with `status = 'pending_review'`, ordered by `attempted_at`. Powers the teacher's "View Results" pending-attempts list.

### `GET /api/attempts/:id`
Returns a single attempt's own record (`id`, `quiz_id`, `score`, `total_questions`, `correct_count`, `status`, `attempted_at`). Used by the frontend's sessionStorage-based "check my result later" workaround — not part of any real student-history feature.

### `GET /api/attempts/:id/answers`
Returns every answer for an attempt, joined with its question (`question`, `format`, `model_answer`, `correct_option`) — used by the teacher grading UI to show what a student wrote alongside the reference answer, and reused by the sessionStorage workaround to reconstruct a student's own past result.

### `PATCH /api/attempt-answers/:id/grade`
Body: `{ teacher_score: number }` (0-100). Grades a single open-ended answer, and sets `is_correct = true` if `teacher_score >= 50`. If this was the last ungraded open-ended answer in its attempt, the attempt's final `score` is computed (weighted blend of MCQ % and open-ended average — see `docs/database_schema.md` for the scoring bug fix applied 15 Jul 2026) and `status` flips to `'graded'`. 400 if `teacher_score` isn't a number 0-100, 404 if the answer doesn't exist.

---

## Resources

### `GET /api/resources`
Returns all resources (learning materials / links).

---

## Not yet built (referenced in `tasks.md` but missing)

- `PUT /api/quizzes/:id` — full quiz metadata update (title/description/category); only `type` and `is_published` can currently be updated after creation, via their own dedicated `PATCH` endpoints
- `GET /api/quizzes/:id` — combined quiz + questions in one call (currently two separate requests)
- `GET /api/students/me/attempts` — real quiz history, blocked on auth (Task 9); a same-browser sessionStorage stopgap exists instead (see note above), which is not a substitute for this
- All model upload/edit/delete/publish endpoints (Task 2.6, 4.6, 6.2/6.3 model portions) — models have no management API at all right now
- All auth endpoints (Task 9.1, 9.2)
- `GET /api/labels/:id/video` — cannot be built as originally specified; there is no `labels` table (see `docs/database_schema.md`, open question #3, for the architecture decision needed)
- All label/annotation position-editing beyond current CRUD (Task 5.4/5.5 wiring is actually done on the frontend side — see `tasks.md` — this line is now stale, kept for reference until confirmed)
- All download/export endpoints (Task 10.1, 10.2)