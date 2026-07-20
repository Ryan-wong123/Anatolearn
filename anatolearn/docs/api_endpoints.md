# API Endpoints

Base URL (local dev): `http://localhost:5000/api`

Every endpoint below requires a valid JWT (`Authorization: Bearer <token>`) except `GET /api/health`, `GET /api/programs`, `POST /api/auth/register`, and `POST /api/auth/login` — see the Auth section for the full middleware writeup. This was not true before 20 Jul 2026; an earlier version of this note said auth didn't exist yet.

**CORS:** `cors()` is configured with `exposedHeaders: ['Content-Disposition']` (added 20 Jul 2026) — required for the browser to read the real filename on model downloads (Task 10.1) and annotation exports (Task 10.2). Without it, `fetch()` in the frontend can't see that header cross-origin (frontend:5173, backend:5000 are different origins) and downloads silently fall back to a generic filename. This was caught via real-browser testing, not `curl` (`curl` doesn't enforce CORS, so it looked fine in isolated backend testing) — worth remembering for any future endpoint that sets a custom response header the frontend needs to read.

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
Returns models, optionally filtered. Query params (all optional, combinable):
- `published=true` — only published models
- `system=<value>` — exact match on `body_system`
- `part=<value>` — exact match on `body_part`
- `q=<text>` — case-insensitive substring match on title or description

Returns `[]` (not 404) when nothing matches. With no query params at all, returns everything.

### `GET /api/models/:id`
Returns a single model. 404 if not found.

### `POST /api/models/upload` (teacher only)
Multipart form: `title` (required), `description?`, `program_id?`, `body_system?`, `body_part?`, `model` (file — `.glb`/`.gltf`/`.obj` only). Created unpublished (`is_published: false`). 400 if no title or no file, or an unsupported extension.

### `PUT /api/models/:id` (teacher only)
Body: `{ title, description?, body_system?, body_part? }`. Updates model metadata. 400 if no title, 404 if not found.

### `DELETE /api/models/:id` (teacher only)
Deletes the database row. 404 if not found. **Known gap:** does not delete the underlying file from disk, same known gap as video delete.

### `PATCH /api/models/:id/publish` (teacher only)
Body: `{ is_published: boolean }`. Toggles visibility.

### `PATCH /api/models/:id/thumbnail`
Body: `{ thumbnailDataUrl: string }` (base64 PNG data URL). Saves a thumbnail image to disk and updates `thumbnail_path`. 400 if missing data, 404 if model not found. Called automatically by `Viewer.tsx` the first time a model is opened and has no existing thumbnail — this is why it's `authenticate`-only rather than teacher-only, any logged-in user can trigger it just by viewing a model.

### `GET /api/models/:id/download`
Streams the model file (via Express's `res.download()`, which handles `Content-Disposition`/`Content-Type` automatically). Filename is the model's title (sanitized) plus its real extension, not the randomized on-disk filename. Teachers can download any model; students only published ones (403 otherwise). Logs the download to the `downloads` table (`model_id`, `downloaded_by` — the real authenticated user's id, `downloaded_at`) on a best-effort basis; a failed log insert doesn't block the download itself. 404 if the model doesn't exist.

---

## Annotations

Powers the full `Viewer.tsx` 3D interaction system — point markers, freehand draw highlights, and filled surface regions. Confirmed working end-to-end as of 15 Jul 2026.

### `GET /api/models/:id/annotations`
Returns all annotations for a model.

### `POST /api/models/:id/annotations` (teacher only)
Body: `{ annotation_type: 'point' | 'highlight' | 'region_fill', label, description?, color?, annotation_data? }`. Creates an annotation.

### `PUT /api/annotations/:id` (teacher only)
Same body shape as POST. Updates an annotation. 404 if not found.

### `DELETE /api/annotations/:id` (teacher only)
Deletes an annotation. 404 if not found.

### `GET /api/models/:id/annotations/export?format=json|csv` (teacher only)
Exports a model's annotations as a downloadable file (defaults to `json` if `format` is omitted or anything other than `csv`). JSON returns the full annotation rows as-is. CSV flattens `id, annotation_type, label, description, color, annotation_data, created_at` into columns, with `annotation_data` stringified into its own column (its shape genuinely varies by `annotation_type`, so it doesn't flatten into fixed position columns the way the original `labels` design assumed). Values containing commas, quotes, or newlines are properly CSV-escaped.

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

**Resolved 20 Jul 2026:** now records the real authenticated `student_id` (`req.user.id`) on every new attempt, via `quiz_attempts.student_id` (added in `005_add_quiz_attempt_student_id.sql`). This was previously blocked on auth not existing — see `GET /api/students/me/attempts` below for what it unlocked. Attempts submitted before this migration have `student_id: NULL` and can't be retroactively attributed.

### `GET /api/quizzes/:id/attempts/pending`
Returns all attempts for a quiz with `status = 'pending_review'`, ordered by `attempted_at`. Powers the teacher's "View Results" pending-attempts list.

### `GET /api/students/me/attempts`
Returns the logged-in student's own quiz attempt history: `[{ id, quiz_id, quiz_title, score, status, attempted_at }]`, newest first. Scoped strictly to `req.user.id` — there's no `:studentId` param, so a student can't view anyone else's history by guessing an ID. `quiz_title` is joined in from `quizzes` so the frontend doesn't need a second lookup per attempt. Task 8.8, resolved 20 Jul 2026 now that auth exists — see `docs/database_schema.md`'s open questions for the history of why this was blocked.

### `GET /api/attempts/:id`
Returns a single attempt's own record (`id`, `quiz_id`, `score`, `total_questions`, `correct_count`, `status`, `attempted_at`). Originally built for the frontend's sessionStorage-based "check my result later" workaround — now redundant with `GET /api/students/me/attempts` above, but still used by that workaround, which wasn't removed.

### `GET /api/attempts/:id/answers`
Returns every answer for an attempt, joined with its question (`question`, `format`, `model_answer`, `correct_option`) — used by the teacher grading UI to show what a student wrote alongside the reference answer, and reused by the sessionStorage workaround to reconstruct a student's own past result.

### `PATCH /api/attempt-answers/:id/grade`
Body: `{ teacher_score: number }` (0-100). Grades a single open-ended answer, and sets `is_correct = true` if `teacher_score >= 50`. If this was the last ungraded open-ended answer in its attempt, the attempt's final `score` is computed (weighted blend of MCQ % and open-ended average — see `docs/database_schema.md` for the scoring bug fix applied 15 Jul 2026) and `status` flips to `'graded'`. 400 if `teacher_score` isn't a number 0-100, 404 if the answer doesn't exist.

---

## Auth

### `POST /api/auth/register`
Body: `{ name, email, password, role, program_id? }`. `role` must be `'student'` or `'teacher'`. `password` must be at least 8 characters (not currently checked for complexity beyond length). `email` is lowercased and trimmed before storage/lookup. `program_id` is optional (nullable FK).

Hashes the password with bcrypt (10 rounds, via `bcryptjs`) and stores it in the new `users` table (see `docs/database_schema.md`). Returns the created user **without** `password_hash`: `{ id, name, email, role, program_id, created_at }`.

- 400 if `name`/`email`/`password`/`role` missing, if `role` isn't a valid value, or if `password` is under 8 characters
- 409 if the email is already registered

**Open registration, confirmed as a deliberate decision (20 Jul 2026):** anyone can self-register as `'teacher'` through the Register page with no invite code, approval step, or other gate — the `role` dropdown just lets them pick it. This matches `tasks.md`/`PRD.md` as written (neither specifies any restriction), so it wasn't a gap, it's what was built as specified. Explicitly confirmed with Natalie to leave as-is for now rather than add a gating mechanism. Revisit if teacher-account integrity becomes a concern later — options would include an invite/approval flow or an admin-only role-assignment step.

### `POST /api/auth/login`
Body: `{ email, password }`. Looks up the user by (lowercased/trimmed) email, compares `password` against the stored bcrypt hash. On success, signs a JWT (`HS256`, 24h expiry) with payload `{ id, name, role, program_id }` and returns:

```json
{
  "token": "string",
  "user": { "id", "name", "email", "role", "program_id" }
}
```

- 401 if the email doesn't exist **or** the password is wrong — deliberately the same generic `"Invalid email or password"` message either way, so a failed login can't be used to check which emails are registered
- 400 if `email` or `password` is missing
- 500 if `JWT_SECRET` isn't configured on the server (logged as a startup warning too)

Tested: correct login (200 + token), wrong password (401), non-existent email (401, identical message to wrong password), missing password (400), case-insensitive email match (200). See `docs/testing_log.md`.

### Auth middleware (Task 9.3)
Two Express middleware functions, defined near the top of `server.js`:

- **`authenticate`** — requires an `Authorization: Bearer <token>` header, verifies it with `jwt.verify`, and attaches the decoded payload to `req.user`. Returns 401 if the header is missing, malformed, or the token is invalid/expired.
- **`requireTeacher`** — must run after `authenticate`. Returns 403 if `req.user.role !== 'teacher'`.

**Applied to every route except:** `GET /api/health`, `GET /api/programs`, `POST /api/auth/register`, `POST /api/auth/login`. `GET /api/programs` is deliberately left public because the Register page's program dropdown needs it before the user has an account.

**Two judgment calls worth knowing about**, since they're not explicitly specified anywhere:
- `PATCH /api/models/:id/thumbnail` is `authenticate`-only (not teacher-only) — the frontend currently auto-generates a model's thumbnail whenever *anyone* opens the viewer, not just teachers, so gating it to teachers would break that.
- `GET /api/attempts/:id` and `GET /api/attempts/:id/answers` are `authenticate`-only, not teacher-only — the teacher grading UI uses them, but so does the student-facing sessionStorage "check my result" workaround (see Task 8.5/8.7 notes above). Since there's still no `student_id` on attempts, this means any logged-in user can view any attempt's answers by guessing an ID — a real gap, but it's the same underlying gap as the missing `student_id` column, not a new one introduced here.

Full route classification (which routes are public / any-authenticated-user / teacher-only) is in the middleware's inline comments in `server.js` — not duplicated here since it'd just be a second copy to keep in sync.

**Frontend status (updated 20 Jul 2026):** the frontend impact note above is now resolved. `src/api/api.ts` attaches `Authorization: Bearer <token>` to every request via a shared `apiFetch` helper, `Login.tsx` is a real working form, `ProtectedRoute.tsx` actually checks for a token, and `Layout.tsx` has a working logout button. `Register.tsx` is still a stub (Task 9.5, not yet built) — the Login page's "Register" link currently goes nowhere useful. None of this has been confirmed yet against a real running backend + browser session.

---

## Resources

### `GET /api/resources`
Returns all resources (learning materials / links).

---

## Not yet built (referenced in `tasks.md` but missing)

- `GET /api/quizzes/:id` — combined quiz + questions in one call (currently two separate requests: `GET /api/quizzes` + `GET /api/quizzes/:id/questions`)
- `GET /api/labels/:id/video` — cannot be built as originally specified; there is no `labels` table, and whether/how to link video to annotations is an open architecture decision (Task 7.5/7.6) that isn't Natalie's to resolve (Tim owns `Viewer.tsx`, where this would live)
- A "downloads" viewing/reporting endpoint (e.g. "who downloaded what") — the `downloads` table (Task 10.1) logs this data, but nothing currently reads it back out; not referenced by any task as something to build