# API Endpoints

Browser base: `/api` through the same-origin proxy. Direct local backend base: `http://localhost:5000/api`.

Authentication accepts a Bearer JWT or the HttpOnly `anatolearn_session` cookie set at login. Login no longer returns the token in the response body; browsers use the cookie only. Cookie-authenticated unsafe requests (POST/PUT/PATCH/DELETE) must echo the readable `anatolearn_csrf` cookie in an `X-CSRF-Token` header or receive 403 (login, register and logout are exempt; Bearer-token clients are exempt). After 5 failed logins an account is locked for 15 minutes (`MAX_FAILED_LOGINS`, `LOCKOUT_MINUTES`); locked and disabled accounts receive the same generic 401 as a wrong password. Public endpoints are health, programmes, registration, login and logout (logout clears the cookie). Other APIs and teaching-file requests require authentication. Student reads enforce publication plus the account programme or shared programme-null content, even without a published query parameter. Teachers can read drafts. `X-Program-Name` additionally filters list responses; it never expands account access.

CORS allows credentialed configured FRONTEND_ORIGINS and exposes Content-Disposition. Unsafe requests with an untrusted Origin return 403. JSON 401 responses cause the frontend to clear its identity. Unavailable content/other students' attempts return 404; role-restricted actions return 403.

Teaching files are served through authenticated ownership checks, not express.static. Model/video/resource/thumbnail URLs use the same origin and the media-session cookie; byte ranges are supported. Alternate development `/public` and `/@fs` paths are denied and teaching files are not copied into the frontend build. See storage_structure.md.

---

## Health

### `GET /api/health`
Returns `{ status: "ok" }` if the database connection is alive, otherwise 500 `{ status: "error" }`.

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
- `q=<text>` — case-insensitive substring match on title, description, body system or body part

Returns `[]` (not 404) when nothing matches. With no query params at all, returns everything.

### `GET /api/models/:id`
Returns a single model. 404 if not found.

### `POST /api/models/upload` (teacher only)
Multipart form: `title` (required), `description?`, `program_id?`, `body_system?`, `body_part?`, `model` (file — GLB/embedded glTF/OBJ/USDZ). Created unpublished (`is_published: false`). 400 if no title or no file, or an unsupported extension.

### `PUT /api/models/:id` (teacher only)
Body: `{ title, description?, body_system?, body_part? }`. Updates model metadata. 400 if no title, 404 if not found.

### `DELETE /api/models/:id` (teacher only)
Deletes the database row. 404 if not found. **Known gap:** does not delete the underlying file from disk, same known gap as video delete.

### `PATCH /api/models/:id/publish` (teacher only)
Body: `{ is_published: boolean }`. Toggles visibility.

### `PATCH /api/models/:id/thumbnail`
Body: `{ thumbnailDataUrl: string }` (base64 PNG data URL). Saves a thumbnail image to disk and updates `thumbnail_path`. 400 if missing data, 404 if model not found. Teacher-only. Called automatically when a teacher opens a model without an existing thumbnail; student viewing never writes thumbnails.

### `GET /api/models/:id/download`
Streams the model file (via Express's `res.download()`, which handles `Content-Disposition`/`Content-Type` automatically). Filename is the model's title (sanitized) plus its real extension, not the randomized on-disk filename. Both roles require is_downloadable=true. Students additionally require publication and their account programme/shared content; disabled downloads return 403. Logs the download to the `downloads` table (`model_id`, `downloaded_by` — the real authenticated user's id, `downloaded_at`) on a best-effort basis; a failed log insert doesn't block the download itself. 404 if the model doesn't exist.

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
Returns a single video. 404 if not found. For students the body also carries `resume_position` (seconds, 0 if none) from their last visit.

### `PUT /api/videos/:id/progress`
Authenticated. Body `{ position }` (seconds, 0–86400); 400 otherwise, 204 on success. Only a student's own existing `user_activity` row is updated (created by opening the video); other roles are accepted and ignored.

### `POST /api/videos/upload`
Teacher-only multipart form upload. Fields: `video` (required, MP4/WebM, 200 MiB), optional `captions` (English WebVTT `.vtt`, UTF-8, starts with `WEBVTT`, maximum 2 MiB), `title` (required), optional `description` and `program_id`. Files receive generated UUID names under `PUBLIC_DIR/videos/` and `PUBLIC_DIR/captions/`; the new video is unpublished and returns `captions_path` (null if omitted). Validation/database failures remove newly uploaded files.

### `POST /api/videos/:id/captions`
Teacher-only multipart form with exactly one `captions` WebVTT file (UTF-8, `.vtt`, maximum 2 MiB). Replaces the existing track and returns the updated video record. Rejects malformed files with 400 and missing videos with 404. The replaced caption file is removed after the database update.

### `DELETE /api/videos/:id/captions`
Teacher-only. Removes the track from the video and returns the updated record (`captions_path: null`). A video without captions is a successful no-op. 404 if the video does not exist.

### `GET /captions/:filename`
Authenticated asset route, not public static hosting. Access follows the owning video’s visibility and programme policy, so students can load tracks only for accessible published videos; teachers can preview draft tracks. Serves private/no-store WebVTT with nosniff protections.

### `DELETE /api/videos/:id` (added 15 Jul 2026)
Deletes a video's database row. 404 if not found. As with video/media assets, deleting the row does not currently garbage-collect the underlying files.

### `PATCH /api/videos/:id/publish` (added 15 Jul 2026)
Body: `{ is_published: boolean }`. Toggles publish state, same pattern as the quiz equivalent. 404 if not found.

### `PUT /api/videos/:id` (added 15 Jul 2026)
Body: `{ title, description?, annotation_id? }`. Updates a video's metadata. Does not support changing the video file itself or `program_id`. `annotation_id` (added 20 Jul 2026, Task 7.6) links the video to an annotation — omit it (or send `null`) to leave it unlinked / clear an existing link. 400 if `title` missing, 404 if not found.

### `GET /api/annotations` (teacher only, added 20 Jul 2026 — Task 7.6)
Lists every annotation across every model, each with its model's title joined in: `[{ id, label, annotation_type, model_title }]`, ordered by model title then label. Powers the video-linking dropdown in `Videos.tsx`'s edit form — not used anywhere else, so it's teacher-gated even though the underlying data (annotations) is otherwise readable by any logged-in user via `GET /api/models/:id/annotations`.

---

## Quizzes

**Real student history now exists (Task 8.8, 20 Jul 2026)** — see `GET /api/students/me/attempts` further down. The `sessionStorage` workaround described below predates that and was not removed, since it still works as a same-browser fallback, but it's redundant now.

**Known limitation — student result visibility (historical, kept for context):** before auth existed, the frontend used a same-browser `sessionStorage` workaround to let a student see their result after a teacher grades it: the attempt id is stored in `sessionStorage` keyed by quiz id after submission, and `handleStartQuiz` checks for it before starting a fresh attempt. This only works on the same browser/device the student originally submitted from — it was never real quiz history and doesn't survive a cleared cache, a different device, or a different user opening the app.

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
Returns all attempts for a quiz with `status = 'pending_review'`, ordered by `attempted_at`. Retained as a pending-only API; the teacher UI now uses GET /api/quizzes/:id/attempts to include graded results.

### `GET /api/students/me/attempts`
Returns the logged-in student's own quiz attempt history: `[{ id, quiz_id, quiz_title, score, status, attempted_at }]`, newest first. Scoped strictly to `req.user.id` — there's no `:studentId` param, so a student can't view anyone else's history by guessing an ID. `quiz_title` is joined in from `quizzes` so the frontend doesn't need a second lookup per attempt. Task 8.8, resolved 20 Jul 2026 now that auth exists — see `database_schema.md`'s open questions for the history of why this was blocked.

### `GET /api/attempts/:id`
Returns a single attempt's own record (`id`, `quiz_id`, `score`, `total_questions`, `correct_count`, `status`, `attempted_at`). Originally built for the frontend's sessionStorage-based "check my result later" workaround — now redundant with `GET /api/students/me/attempts` above, but still used by that workaround, which wasn't removed.

### `GET /api/attempts/:id/answers`
Returns every answer for an attempt, joined with its question (`question`, `format`, `model_answer`, `correct_option`) — used by the teacher grading UI to show what a student wrote alongside the reference answer, and reused by the sessionStorage workaround to reconstruct a student's own past result.

### `PATCH /api/attempt-answers/:id/grade`
Body: `{ teacher_score: number }` (0-100). Grades a single open-ended answer, and sets `is_correct = true` if `teacher_score >= 50`. If this was the last ungraded open-ended answer in its attempt, the attempt's final `score` is computed (weighted blend of MCQ % and open-ended average — see `database_schema.md` for the scoring bug fix applied 15 Jul 2026) and `status` flips to `'graded'`. 400 if `teacher_score` isn't a number 0-100, 404 if the answer doesn't exist.

---

## Auth

### `POST /api/auth/register`
Body: `{ name, email, password, role, program_id? }`. `role` must be `'student'` or `'teacher'`. `password` must be at least 8 characters (not currently checked for complexity beyond length). `email` is lowercased and trimmed before storage/lookup. `program_id` is optional (nullable FK).

Hashes the password with bcrypt (10 rounds, via `bcryptjs`) and stores it in the new `users` table (see `database_schema.md`). Returns the created user **without** `password_hash`: `{ id, name, email, role, program_id, created_at }`.

- 400 if `name`/`email`/`password`/`role` missing, if `role` isn't a valid value, or if `password` is under 8 characters
- 409 if the email is already registered

**Open registration, confirmed as a deliberate decision (20 Jul 2026):** anyone can self-register as `'teacher'` through the Register page with no invite code, approval step, or other gate — the `role` dropdown just lets them pick it. This matches `tasks.md`/`PRD.md` as written (neither specifies any restriction), so it wasn't a gap, it's what was built as specified. Explicitly confirmed with to leave as-is for now rather than add a gating mechanism. Revisit if teacher-account integrity becomes a concern later — options would include an invite/approval flow or an admin-only role-assignment step.

### `POST /api/auth/login`
Body: `{ email, password }`. Looks up the user by (lowercased/trimmed) email, compares `password` against the stored bcrypt hash. On success, signs a JWT (`HS256`, 24h expiry) with payload `{ id, name, role, program_id }` and returns:

```json
{
 "token": "string",
 "user": { "id", "name", "email", "role", "program_id" }
}
```

- If the account has two-factor authentication on, the response is instead `{ "mfa_required": true, "mfa_token": "..." }` (no session cookie yet). Send the token and a code to `POST /api/auth/mfa/verify`. On a normal sign-in the body also contains `mfa_setup_required` (true when the account's role requires two-factor authentication and it is not set up).
- 401 if the email doesn't exist **or** the password is wrong — deliberately the same generic `"Invalid email or password"` message either way, so a failed login can't be used to check which emails are registered
- 400 if `email` or `password` is missing
- 500 if `JWT_SECRET` isn't configured on the server (logged as a startup warning too)

Tested: correct login (200 + token), wrong password (401), non-existent email (401, identical message to wrong password), missing password (400), case-insensitive email match (200). See `testing_log.md`.

### Auth middleware (current implementation, 22 October 2026)

authenticate in backend/src/access.js accepts a bearer token or HttpOnly session cookie, verifies JWT claims and checks the live database session/current user through auth.repository.js. middleware/roles.js supplies requireTeacher and requireStudent. middleware/contentAccess.js enforces direct content/attempt ownership using catalog.repository.js.

Health, programmes, register, login and logout register before the global /api authentication gate. Logout clears invalid/expired cookies too and revokes a valid presented session. Teaching assets authenticate separately. Thumbnail writes require teachers; attempt details/answers require the owning student or a teacher. Shared content additionally respects publication and programme rules.

Route classification is declared in backend/src/modules/<feature>/<feature>.routes.js. Controllers adapt plain service results through http/controller.js, services own workflows and repositories own SQL. The feature refactor preserves existing endpoint paths, request/response bodies, authentication, cookies and errors; no client or schema migration is needed.

---

## Resources

### `GET /api/resources`
Returns all resources (learning materials / links).

---

## Not yet built (referenced in `tasks.md` but missing)

- `GET /api/quizzes/:id` — combined quiz + questions in one call (currently two separate requests: `GET /api/quizzes` + `GET /api/quizzes/:id/questions`)
- `GET /api/labels/:id/video` — cannot be built as originally specified; there is no `labels` table, and whether/how to link video to annotations is an open architecture decision (Task 7.5/7.6) that isn't the to resolve (Tim owns `Viewer.tsx`, where this would live)
- A "downloads" viewing/reporting endpoint (e.g. "who downloaded what") — the `downloads` table (Task 10.1) logs this data, but nothing currently reads it back out; not referenced by any task as something to build

## Access and assessment changes — 22 October 2026

This section supersedes older submission/download/result behavior in historical notes above.

| Endpoint | Access | Request / result |
|---|---|---|
| POST /api/auth/mfa/verify | public, origin checked, rate limited | body `{ mfa_token, code }`; `code` is a 6-digit authenticator code or a recovery code. Success sets the session cookies and returns `{ user }` (plus `recovery_codes_remaining` if a recovery code was used); 401 otherwise. Wrong codes count towards the account lockout |
| POST /api/auth/logout | public, origin checked | clears media cookie; frontend then clears sessionStorage |
| PATCH /api/models/:id/download-permission | teacher | `{is_downloadable: boolean}` -> model; default false; downloads require read access and this flag for both roles |
| PATCH /api/:kind/:id/program | teacher | kind=models/videos/quizzes/resources; `{program_id: positive integer or null}` -> updated record; null means shared |
| PATCH /api/models/:id/thumbnail | teacher | existing PNG request; student writes now forbidden |
| PATCH /api/quizzes/:id/timer | teacher | `{time_limit_seconds: 30..86400 integer or null}` -> quiz; null is untimed |
| POST /api/quizzes/:id/start | student with content access | `{}` -> `{session_id, expires_at, questions}`; server snapshot, answer keys omitted |
| POST /api/quiz-sessions/:id/cancel | session owner | closes unused session; used by cancel/navigation |
| POST /api/quizzes/:id/submit | session owner/student | `{session_id, answers:[{question_id,selected_option?,answer_text?}]}`; each snapshot question exactly once; blanks explicitly represented; rejects missing/foreign/duplicate IDs and invalid options |
| GET /api/quizzes/:id/attempts | teacher | all graded and pending attempts, including student_name |
| GET /api/attempts/:id and /api/attempts/:id/answers | owner or teacher | other accounts receive 404; answer review includes question/options and grading. For students `correct_option` and `model_answer` are `null` until the attempt is `graded` (all-MCQ attempts are graded at once; attempts with open-ended questions after the teacher finishes marking). The `feedback` in the `POST /api/quizzes/:id/submit` response follows the same rule |
| PATCH /api/attempt-answers/:id/grade | teacher | finite `{teacher_score:0..100}`, open-ended answers only; transactional update/final score |
| GET /api/question-bank | teacher | bank records including category and keys |
| POST /api/question-bank/from-question/:id | teacher | `{category?: string}` -> independent bank copy |
| PUT /api/question-bank/:id | teacher | complete question/format/category and MCQ options/key or model_answer |
| DELETE /api/question-bank/:id | teacher | removes bank record; quiz copies retained |
| POST /api/quizzes/:id/bank-questions/:bankId | teacher | independent per-quiz copy, including category; quiz type derived |

Starting an attempt and changing its questions coordinate through parent-quiz locks. Question CRUD/imports reject quizzes with existing attempts or active sessions (409); use a new quiz for revised assessments. Submission locks and consumes its session in one transaction with attempt/answers. Replays and expired sessions return 409; validation returns 400; database failures roll back all writes. Timed sessions allow a ten-second delivery grace after their deadline; the browser auto-submits on timeout. Open-ended results remain pending until graded.

Model upload adds USDZ and validates GLB/glTF/OBJ/USDZ headers/content structure. New glTF uploads must embed their dependencies or be converted to GLB; unsupported UASSET returns an export instruction. Resource upload adds `resource_type=image` for PNG/JPEG/WebP and checks basic signatures/type consistency. External links must use HTTP(S). Failed uploads clean up their new files. Model downloading returns the original file; separate JSON/CSV annotations are not embedded into it.


## Session lifecycle update — 22 October 2026

Login retains `{token,user}` and the media cookie, adding a UUID `sid` JWT claim backed by auth_sessions. Authenticated API and asset requests require an unrevoked, unexpired stored session; current role/programme are read from users. Tokens without sid require re-login. Logout revokes the presented bearer/cookie session and clears its cookie; repeating logout with an invalid/expired token still clears the cookie. Other sessions remain signed in.

`POST /api/quizzes/:id/start` additionally returns `server_now` and `session_expires_at`. The UI uses server_now to correct clock offset. `expires_at` remains the optional assessment timer; the independent lease prevents abandoned untimed sessions from lasting indefinitely. Submission returns 409 after either the lease or timed deadline plus ten seconds. Question edits stay blocked during this transport grace. Maintenance closes expired sessions and later removes closed session records, without deleting historical attempts/answers.


## Frontend error handling update — 22 October 2026

Server routes and request/response schemas are unchanged. The browser API layer now throws `ApiError` with a client-side `status` field (0 for a connection failure). Non-empty 4xx JSON messages are preserved for validation/permissions; 5xx diagnostics, non-JSON errors and malformed successful JSON produce readable fallback messages. Login preserves the generic invalid-credentials message for 401 and separately reports service/network failures. JSON and binary requests share protected-401 identity cleanup and the session-expired event.

Try again on a page/status panel repeats only its read operation. It does not replay uploads, submissions, grading or destructive actions. Teacher finalization/discard and bank refresh failures remain visible in the editor. Video metadata and media playback have separate retry controls.

---

## Paging

List endpoints for models, videos, quizzes and resources accept optional `page` (1-based) and `page_size` (max 100). Without `page_size` every visible row is returned, as before. The full count of visible rows is returned in the `X-Total-Count` header. `/api/users` and `/api/audit-log` always page (defaults 25 and 50).

## Profile (any signed-in user)

- `GET /api/profile` returns name, email, role, programme and last sign-in.
- `PUT /api/profile` `{ name, program_id? }`. Students keep their registered programme (it controls content access); teachers may change theirs.
- `GET /api/profile` also returns `mfa_enabled`, `mfa_required` and `mfa_recovery_codes_left`.
- Two-factor authentication (teachers and administrators): `POST /api/profile/mfa/setup` `{ password }` returns `{ secret, otpauth_uri }`; `POST /api/profile/mfa/enable` `{ code }` turns it on and returns the one-time `recovery_codes`; `POST /api/profile/mfa/disable` `{ password, code }` (403 when `MFA_REQUIRED` applies to the role); `POST /api/profile/mfa/recovery-codes` `{ password, code }` replaces the recovery codes. When `MFA_REQUIRED=true`, a staff account that has not enrolled gets `403 { code: 'mfa_setup_required' }` from every endpoint except `GET /api/profile` and the setup/enable calls.
- `PUT /api/profile/password` `{ current_password, new_password }` (the password policy: 8 characters, 12 for teachers and administrators, 72 bytes at most, uppercase letter and number, not common, not containing the name or email; a 400 explains which rule failed). Signs out all other sessions. The same policy applies to `POST /api/auth/register` and to passwords an administrator sets in `POST /api/users` and `POST /api/users/:id/reset-password`.
- `GET /api/favorites` (student) returns `{ videos, quizzes, models, resources }`; `POST /api/favorites` `{ item_type: 'video'|'quiz'|'model'|'resource', item_id }` and `DELETE /api/favorites/:item_type/:item_id` accept the same four types (models and resources added by migration 017). Unpublished or other-programme content is excluded/refused.
- `GET /api/profile/export` downloads the user's own data as JSON (account, quiz attempts and answers, favourites, activity, downloads).
- `DELETE /api/profile` `{ password }` deletes the account. The only active teacher cannot delete themselves.

## Users and audit log (administrator only)

These routes require the `admin` role (`403 Administrator access required` for everyone else, including teachers). `GET /api/dashboard` returns `{ "role": "admin" }` for administrators, who have no dashboard figures.

- `GET /api/users?q=&role=&status=active|disabled|locked&page=&page_size=`
- `POST /api/users` `{ name, email, role, program_id?, password? }`. Without a password a temporary one is generated and returned once as `temporary_password`.
- `PATCH /api/users/:id` `{ name?, role?, program_id?, is_active?, unlock? }`. Disabling or changing role revokes the user's sessions. `role` may be `student`, `teacher` or `admin`. Administrators cannot demote or disable themselves, and at least one active administrator must remain. Public registration still accepts only `student` and `teacher`.
- `POST /api/users/:id/reset-password` `{ password? }` generates or sets a password and signs the user out everywhere.
- `POST /api/users/:id/reset-mfa` clears the user's two-factor authentication and signs them out everywhere (for a lost device). Not allowed on yourself. `GET /api/users` rows include `mfa_enabled`.
- `DELETE /api/users/:id`
- `GET /api/audit-log?action=<prefix>&actor=<id>&page=&page_size=` lists authentication events, user management and every successful state-changing API call (who, what, record id, IP; no request bodies).

## Announcements

- `GET /api/announcements` students see unexpired announcements for their programme or everyone; teachers see all.
- `POST /api/announcements`, `PUT /api/announcements/:id`, `DELETE /api/announcements/:id` (teacher) with `{ title, body, program_id?, expires_at? }`.

## Search and dashboards

- `GET /api/search?q=` (min 2 chars) searches models, videos, quizzes, library items and annotation labels the user may see (max 8 per group).
- `GET /api/dashboard` students: recent activity, content counts, announcements, quiz progress and category accuracy; teachers: totals, pending reviews, recent attempts, quiz performance.
- `GET /api/students/me/stats` (student) quiz summary, per-quiz progress and per-category accuracy for "where to focus".
- `GET /api/teacher/overview` (teacher) the teacher dashboard figures.

## Uploads

Uploaded files are scanned with ClamAV when `CLAMAV_HOST` is set. Infected files return 400; with `CLAMAV_REQUIRED=true` uploads return 503 while the scanner is unavailable.
