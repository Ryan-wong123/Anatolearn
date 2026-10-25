# Database Schema

## Docker initialization

The local Docker Compose PostgreSQL service mounts `backend/sql` to `/docker-entrypoint-initdb.d` as a read-only init directory. On first startup with an empty `postgres_data` volume, the official PostgreSQL image runs the scripts in filename order:

1. `001_schema.sql`
2. `002_seed.sql`
3. `003_add_users.sql` (added 20 Jul 2026 — Task 9.1)
4. `004_add_model_fields_and_downloads.sql` (added 20 Jul 2026 — Tasks 4.1, 10.1)
5. `005_add_quiz_attempt_student_id.sql` (added 20 Jul 2026 — Task 8.8)
6. `006_add_video_annotation_link.sql` (added 20 Jul 2026 — Task 7.6)

This creates the local `anatolearn` database schema and seed data automatically for new project setups. The init scripts do not rerun when an existing database volume is present — `003` through `006` are all written to be additive-only (no `DROP TABLE`s) so they're also safe to run manually against an existing dev database. See each file's header comment for the exact command.

> Status: **Draft — database not yet built.** Based on Task 1.2's original table list, updated with confirmed requirements from 'Project Details Reference' tab under ITP Google Doc, and gaps found while reviewing the actual frontend (`Quizzes.tsx`, `Videos.tsx`). For Member B's review before creating tables — not a final, locked spec.

---

## `users`
**Status: Built 20 Jul 2026.** Registration (9.1), login/JWT (9.2), and auth middleware (9.3) all done. Added via `003_add_users.sql`, not `001_schema.sql`.

Differs from the original Task 1.2 proposal in one way: `program` is `program_id` (an FK to `programs.id`, matching the pattern used by `models`/`videos`/`quizzes`/`resources`), not a free-text column.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| program_id | INTEGER | FK → `programs.id`, `ON DELETE SET NULL`, nullable |
| name | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE. Stored lowercased/trimmed |
| password_hash | TEXT | NOT NULL. bcrypt via `bcryptjs`, 10 rounds |
| role | user_role (enum) | `'student'` \| `'teacher'` \| `'admin'`, NOT NULL, default `'student'` (`'admin'` added by `015_admin_role.sql`) |
| created_at | TIMESTAMP | default `CURRENT_TIMESTAMP` |

Tested end-to-end against a real Postgres instance: valid registration (201, password_hash correctly excluded from response, confirmed 60-char bcrypt hash in db), duplicate email (409), missing required fields (400), invalid `role` value (400), password under 8 characters (400). See `testing_log.md`.

**Status: fully built and confirmed 20 Jul 2026.** Every piece of Week 9 is now in place and confirmed working end-to-end in the real Docker/browser environment: registration, login, route/role middleware, real Login and Register pages, token attached to every request, protected routes, and logout. The `role`/`program` toggle that used to be in `Layout.tsx`'s nav bar is gated behind Vite's `import.meta.env.DEV` flag, confirmed (via inspecting the actual `npm run build` output) to compile to a hardcoded `false` in production, so it cannot appear or function outside local development.

---

## `anatomy_models`
No changes from original Task 1.2 spec.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| title | text | |
| description | text | |
| file_path | text | |
| file_format | text | .obj / .gltf / .glb / .usdz / .uasset |
| body_system | text | |
| body_part | text | |
| uploaded_by | uuid / int | references users.id |
| created_at | timestamp | |
| is_published | boolean | needed for Task 6.2, missing from original Task 1.2 list |

**Status: Built as `models` (renamed from `anatomy_models`), diverges from this proposal in a few ways, but is now feature-complete relative to what the project actually needs.** No `file_format` or `uploaded_by` columns exist — format is inferred from `file_path`'s extension when needed (e.g. for download `Content-Type`), and there's no per-model uploader tracking. Uses `program_id` (FK to `programs.id`) rather than being programme-agnostic. Actual columns as of 20 Jul 2026: `id`, `program_id`, `title`, `description`, `file_path`, `thumbnail_path`, `is_published`, `body_system`, `body_part`, `created_at`, `updated_at`.

`is_published` was added 15 Jul 2026 (Task 6.2) — models do have publish gating, same as videos and quizzes; the earlier note in this file claiming otherwise was stale. `body_system`/`body_part` were added 20 Jul 2026 via `004_add_model_fields_and_downloads.sql` (Tasks 4.1/4.4) — free-text columns, not constrained to a fixed enum, so their possible values are whatever teachers actually type in the upload/edit form.

Full CRUD, publish toggle, search (`?q=`), and system/part filtering are all built and tested against `GET`/`POST`/`PUT`/`DELETE /api/models...` — see `api_endpoints.md`. Models are viewed via a `ModelGallery.tsx` page (browsing, now with search/filter and a download button) and `Viewer.tsx` (individual model + annotations), both confirmed working — see the `annotations` section below for how the 3D viewer actually works.

---

## `labels` — original proposal, superseded by `annotations`

**Status: Not built as designed. Confirmed superseded by a different, working system.** This session confirmed `Viewer.tsx` (built by Member B) does not implement a simple point-label system at all — it implements a full annotation system with three types (`point`, `highlight` a.k.a. freehand draw, and `region_fill` a.k.a. filled surface region), each persisted via the `annotations` table below. This is more capable than what this section originally proposed, but means anything in `tasks.md` referring to "labels" (Tasks 5.x, 7.5, 7.6) needs reinterpreting against `annotations` — see `tasks.md` for the specific divergence notes on each task.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| model_id | uuid / int | references anatomy_models.id |
| name | text | |
| description | text | |
| position_x | float | |
| position_y | float | |
| position_z | float | |
| created_by | uuid / int | references users.id |
| created_at | timestamp | |

---

## `videos`
**Change from original Task 1.2 spec:** added `thumbnail` and `is_published` — both are fields the actual frontend (`Videos.tsx` `Video` interface) already expects but weren't in the original table list.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| title | text | |
| description | text | |
| file_path | text | |
| category | text | Muscular / Cardiovascular / Respiratory / Digestive / Nervous / Endocrine |
| linked_label_id | uuid / int, nullable | references labels.id |
| uploaded_by | uuid / int | references users.id |
| created_at | timestamp | |
| thumbnail | text, nullable | **added** — frontend `Video` interface has this field |
| is_published | boolean | **added** — needed for Task 6.2, missing from original Task 1.2 list |

**Status: Built, diverges from this proposal, updated 20 Jul 2026.** Actual columns: `id`, `program_id` (references `programs.id`), `title`, `description`, `video_path` (not `file_path`), `thumbnail_path` (not `thumbnail`), `is_published` (matches this proposal), `annotation_id` (added 20 Jul 2026, Task 7.6 — see below), `created_at`. No `category` or `uploaded_by` columns exist.

`linked_label_id` is now resolved as `annotation_id` — added via `006_add_video_annotation_link.sql`, a nullable FK to `annotations.id` (`ON DELETE SET NULL`, so deleting an annotation un-links any video pointing at it rather than deleting the video). This was an open architecture question for a while (see Question 3 below); Decided it herself and built the `Videos.tsx`/backend half (Task 7.6). The direction (FK on `videos` pointing at the annotation, not the reverse) matches this section's original `linked_label_id` proposal more closely than the alternative would have.

| Column (as built) | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| program_id | integer, nullable | references programs.id, ON DELETE SET NULL |
| title | varchar(255) | not null |
| description | text | |
| video_path | text | not null |
| thumbnail_path | text, nullable | |
| is_published | boolean | not null, default false |
| annotation_id | integer, nullable | references annotations.id, ON DELETE SET NULL — **added 20 Jul 2026** |
| created_at | timestamp | default CURRENT_TIMESTAMP |
| captions_path | text, nullable | English WebVTT track path; added by `010_video_captions.sql` |

---

## Static file serving — bug found and fixed (15 Jul 2026)

Uploaded video files (and previously, model thumbnails) were being correctly saved to disk under `PUBLIC_DIR` (`/public` in the container), but **Express had no `express.static` middleware serving that directory at all**. This meant every `video_path` and `thumbnail_path` URL stored in the database (e.g. `/videos/s.mp4`) was a dead link — the file physically existed, but requesting its URL returned a 404. This predates this round's work; it affected the original seeded video and any model thumbnails generated by `Viewer.tsx` since Member B first built that feature.

**Fix:** added `app.use(express.static(process.env.PUBLIC_DIR || path.join(__dirname, "../../public")));` near the top of `server.js`, after the JSON body-parser middleware. Verified by loading `http://localhost:5000/videos/s.mp4` directly in browser — confirmed playing.

---

## `quizzes`
**Status: Built.** Matches this section's proposal — `type`, `category`, `is_published` were added as planned.

**Confirmed requirement (Project Details Reference, "self assessment" section):** "assessment are practical are open ended questions, theory is mcq" — confirms quizzes need a type distinction, and "system based categories (respiratory system, Cardiovascular, etc.)" confirms the category field is a real requirement, not an extra.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| program_id | integer, nullable | references programs.id, ON DELETE SET NULL |
| title | varchar(255) | not null |
| description | text | |
| type | quiz_type enum | 'MCQ' / 'Practical' / 'Mixed', default 'MCQ' |
| category | varchar(100) | |
| is_published | boolean | not null, default false |
| created_at | timestamp | default CURRENT_TIMESTAMP |

**Divergence from original plan:** no `created_by` column exists yet — there's no `users` table or auth (Task 9 not built), so quizzes aren't attributed to a specific teacher. Uses `program_id` (references a `programs` table) rather than a free-text program field.

**Update:** `type` is no longer manually chosen by the teacher at quiz creation. It is now auto-derived from the actual question formats present (see `quiz_questions` below) and pushed via `PATCH /api/quizzes/:id/type` right before the quiz is published. The teacher-facing Type `<select>` was removed from the quiz creation form.

---

## `questions` — original proposal, now partially realized differently

**Status: Built as `quiz_questions`, using a merged single-table approach rather than the fully separate open-ended fields originally proposed here.** The core idea (a `question_format` distinction between MCQ and open-ended) was implemented, but as an additional `format` column and nullable MCQ fields on the same table — not as two structurally separate paths. See `## quiz_questions (as built)` below for the actual schema.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| quiz_id | uuid / int | references quizzes.id |
| question_text | text | |
| question_format | text | **added** — 'mcq' or 'open_ended' |
| option_a | text, nullable | only used when question_format = 'mcq' |
| option_b | text, nullable | only used when question_format = 'mcq' |
| option_c | text, nullable | only used when question_format = 'mcq' |
| option_d | text, nullable | only used when question_format = 'mcq' |
| correct_option | text, nullable | only used when question_format = 'mcq' — which of a/b/c/d is correct |
| model_answer | text, nullable | **added** — only used when question_format = 'open_ended', since there's no fixed correct option to check against |

---

## `quiz_questions` (as built)

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| quiz_id | integer | references quizzes.id, ON DELETE CASCADE |
| question | text | not null |
| format | question_format enum | 'mcq' / 'open_ended', default 'mcq' |
| option_a | text, nullable | required when format = 'mcq' |
| option_b | text, nullable | required when format = 'mcq' |
| option_c | text, nullable | required when format = 'mcq' |
| option_d | text, nullable | required when format = 'mcq' |
| correct_option | char(1), nullable | required when format = 'mcq' — CHECK IN ('A','B','C','D') |
| model_answer | text, nullable | required when format = 'open_ended' — reference answer for manual grading, never sent to students |

`GET /api/quizzes/:id/questions` excludes `correct_option` and `model_answer` from its response — neither the correct MCQ answer nor the open-ended reference answer is visible to students before they submit.

---

## `quiz_attempts`
**Status: Built.** Diverges from the original proposal by adding a `status` field not in the original proposal, to support the manual-review flow this section originally asked about. `student_id` — originally missing, added 20 Jul 2026 (Task 8.8) via `005_add_quiz_attempt_student_id.sql`.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| quiz_id | integer | references quizzes.id, ON DELETE CASCADE |
| student_id | integer, nullable | references users.id, ON DELETE SET NULL — added 20 Jul 2026; NULL on any attempt created before this migration |
| score | integer, nullable | percentage 0-100; **null while status = 'pending_review'** |
| total_questions | integer | not null |
| correct_count | integer, nullable | MCQ correct count; null while pending review |
| status | attempt_status enum | 'graded' / 'pending_review', default 'graded' |
| attempted_at | timestamp | default CURRENT_TIMESTAMP |

An attempt becomes `pending_review` if it contains **any** open-ended answers. MCQ portions are still auto-graded and stored immediately (per-answer, in `quiz_attempt_answers`), but the attempt's overall `score` stays null until every open-ended answer in it has been manually scored by a teacher.

**Resolved 20 Jul 2026.** `student_id` added, nullable (`ON DELETE SET NULL` so a deleted account doesn't cascade-delete their quiz history). `POST /api/quizzes/:id/submit` now populates it from `req.user.id`. Powers `GET /api/students/me/attempts` (Task 8.8) — see `api_endpoints.md`. Attempts submitted before this migration keep `student_id: NULL` and can't be retroactively attributed; they were genuinely anonymous when created.

---

## `quiz_attempt_answers` (new — not in original Task 1.2 list)

Stores each individual answer within an attempt, so a teacher can review and grade open-ended responses one at a time rather than only ever seeing an aggregate score.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| attempt_id | integer | references quiz_attempts.id, ON DELETE CASCADE |
| question_id | integer | references quiz_questions.id, ON DELETE CASCADE |
| selected_option | char(1), nullable | set for MCQ answers only |
| answer_text | text, nullable | set for open-ended answers only |
| is_correct | boolean, nullable | auto-set for MCQ on submit; set by teacher grading for open-ended (true if `teacher_score >= 50`) |
| teacher_score | integer, nullable | 0-100, set only when a teacher manually grades an open-ended answer |

**Scoring resolution:** once every open-ended answer for an attempt has a `teacher_score`, the attempt's final `score` is computed as a weighted blend — MCQ percentage (correct MCQs ÷ MCQ count) weighted by the proportion of MCQ questions, open-ended average weighted by the proportion of open-ended questions — and `quiz_attempts.status` flips to `'graded'`. This is an implementation decision (not specified anywhere in the original requirements docs) made to combine auto- and manually-graded portions into one meaningful score; flag to the team if a different weighting is intended.

**Scoring bug fix (15 Jul 2026):** the weighted blend originally divided `mcqCorrect` by `totalQuestions` instead of `mcqCount`, which understated the MCQ portion's contribution to the final score (e.g. 1/1 MCQ correct + all open-ended scored 100 returned 81% instead of the correct 100%). Fixed to divide by `mcqCount`. Any attempts graded before this fix have an incorrect stored `score` and were not retroactively recalculated — only relevant to test data from this development session.

---

## `downloads`
No changes from original Task 1.2 spec. **Status: Built 20 Jul 2026** (Task 10.1), via `004_add_model_fields_and_downloads.sql`.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| model_id | INTEGER | FK → `models.id`, `ON DELETE CASCADE`, NOT NULL |
| downloaded_by | INTEGER | FK → `users.id`, `ON DELETE SET NULL`, nullable |
| downloaded_at | TIMESTAMP | default `CURRENT_TIMESTAMP` |

Matches the original proposal almost exactly — `anatomy_models`/`users` references point at the actual table names (`models`/`users`). `downloaded_by` is nullable (`ON DELETE SET NULL`) so a download record survives even if the user account is later deleted, rather than cascading the delete. Populated by `GET /api/models/:id/download` on a best-effort basis (a failed insert here doesn't block the download itself). Nothing currently reads this table back out — no "download history" or reporting view exists, since no task calls for one.

---

## `programs` (as built, not in original Task 1.2 list)

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| name | varchar(100) | not null, unique |
| description | text | |

Referenced by `models.program_id`, `videos.program_id`, `quizzes.program_id`, `resources.program_id`.

---

## `resources` (as built, not in original Task 1.2 list)

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| program_id | integer, nullable | references programs.id, ON DELETE SET NULL |
| title | varchar(255) | not null |
| description | text | |
| resource_type | resource_type enum | 'pdf' / 'document' / 'link' |
| file_path | text | not null |
| created_at | timestamp | default CURRENT_TIMESTAMP |

Serves the Library page's learning materials / links content, not covered in the original Task 1.2 table list.

---

## `annotations` (as built, replaces the `labels` proposal above)

**Confirmed fully working as of 15 Jul 2026** — powers the entire `Viewer.tsx` 3D interaction system (Tasks 2.x/3.x/5.x in `tasks.md`), not just a simple label system.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| model_id | integer | references models.id, ON DELETE CASCADE |
| annotation_type | annotation_type enum | 'point' / 'highlight' / 'region_fill' |
| label | varchar(255) | not null |
| description | text | |
| color | varchar(20) | |
| annotation_data | jsonb | not null, default `{}` — flexible shape depending on annotation_type |
| created_at | timestamp | default CURRENT_TIMESTAMP |
| updated_at | timestamp | default CURRENT_TIMESTAMP |

No `position_x`/`position_y`/`position_z` or `created_by` columns — position data lives inside the flexible `annotation_data` JSONB column instead (varies by type: a single point, a freehand list of draw points, or a filled region's boundary + triangulated surface mesh + camera plane), and there's no user attribution since auth doesn't exist yet.

`annotation_type` mapping to the frontend's internal `AnnotationKind`: `'point'` ↔ simple point marker, `'highlight'` ↔ freehand draw (a connected line of surface dots), `'region_fill'` ↔ closed-boundary filled surface region (computed via raycasting a screen-space polygon onto the model's actual mesh faces).

**No `video_id`/linked-video field exists on this table** — this is the crux of the open architecture question flagged for Tasks 7.5/7.6 in `tasks.md`: since `annotations` (not `labels`) is what actually exists, "linking a video to a label" has no current home in the schema and needs a decision before any code is written for it.

## Migration 008 — access and assessments (22 October 2026)

Apply `backend/sql/008_access_and_assessments.sql` after 001–007. It is additive and has been applied to the local development database. Existing models default to downloads disabled; existing quizzes remain untimed. Existing content/attempts are retained.

- `models.is_downloadable BOOLEAN NOT NULL DEFAULT false`: explicit teacher-managed download policy.
- `quizzes.time_limit_seconds INTEGER NULL`: 30–86400 when configured; null means untimed.
- `quiz_questions.category VARCHAR(100)`: per-question body-system category, including imported bank copies.
- `resource_type` enum adds `image`.
- `quiz_sessions`: UUID primary key; quiz_id/student_id cascade FKs; started_at TIMESTAMPTZ default NOW; nullable expires_at/submitted_at; questions JSONB NOT NULL containing the server snapshot and answer keys.
- `question_bank`: SERIAL id; question TEXT; question_format enum; category; nullable option_a..d/correct_option/model_answer; created_at TIMESTAMPTZ. Bank records are independent of their source/imported questions.
- `favorites.item_type` allows `video`, `quiz`, `model` and `resource` (`017_favorite_models_resources.sql`).
- `remove_content_favorites` deletion triggers on videos/quizzes/models/resources clean polymorphic favourite references when content is deleted.

Submission transactions lock the session, insert attempt/answers and consume the session atomically. Manual grading locks the attempt and commits its answer/final score together. Question mutations lock their quiz and refuse changes after attempts or while sessions are active; starting a session takes a shared quiz lock while snapshotting. This preserves the existing question FK/history model instead of allowing edits to rewrite old results. Backup/restore and cleanup of old closed sessions remain operational considerations.


## Migration 009 — session lifecycle

`quiz_sessions.session_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '24 hours')` adds an absolute lease. Existing rows receive the later of start+24h and timer+10s. Partial indexes support open-session expiry and closed-session retention.

`auth_sessions`: `id UUID PRIMARY KEY` (JWT sid), `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `expires_at TIMESTAMPTZ NOT NULL`, nullable `revoked_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. An expiry index supports cleanup. Login creates a row; logout records revocation; authentication joins the current user. Session maintenance is transactional and uses an advisory lock. Closed records are removed after configurable retention; quiz_attempts and quiz_attempt_answers are preserved.

---

## Migrations and later additions (011 and newer)

Schema changes are numbered files in `anatolearn/backend/sql`, applied once each by `src/migrate.js` when the API starts (tracked in `schema_migrations`). `001_schema.sql` and `002_seed.sql` are only for empty databases and are baselined on existing ones. Demo content lives in `backend/seed/demo.sql` (development only).

| Table / columns | Purpose |
|---|---|
| `users.is_active`, `failed_login_count`, `locked_until`, `last_login_at`, `password_changed_at` | Account disabling, per-account lockout, sign-in history |
| `models.owner_id`, `videos.owner_id`, `quizzes.owner_id`, `resources.owner_id`, `question_bank.owner_id` | The teacher who owns the row (`ON DELETE SET NULL`, so a deleted teacher's content becomes unclaimed). `NULL` means unclaimed. Announcements use the existing `created_by`. Migration `020_content_owner.sql` |
| `auth_sessions.last_seen_at` | Last request made with the session (refreshed at most once a minute). Sessions idle longer than their role's limit are rejected (migration `019_session_idle.sql`) |
| `users.mfa_secret`, `mfa_pending_secret`, `mfa_enabled_at`, `mfa_last_step`, `mfa_recovery_hashes` | Two-factor authentication (migration `018_mfa.sql`). Secrets are stored AES-256-GCM encrypted, `mfa_last_step` blocks code replay, recovery codes are stored as keyed hashes |
| `audit_log` (actor, action, target, detail JSON, ip, created_at) | Who did what: authentication events, user management, every successful state-changing API call |
| `announcements` (title, body, program_id, expires_at, created_by) | Teacher notices shown to a programme or everyone |
| `user_activity` (user_id, item_type, item_id, view_count, last_viewed_at, position_seconds) | `position_seconds` (migration `016_video_progress.sql`) stores the last video playback position. Powers "continue where you left off" on the student dashboard |

The API connects at runtime as `anatolearn_app` (SELECT/INSERT/UPDATE/DELETE only); migrations and backups use the owner role.
