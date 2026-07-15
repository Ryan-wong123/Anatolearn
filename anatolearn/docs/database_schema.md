# Database Schema

## Docker initialization

The local Docker Compose PostgreSQL service mounts `backend/sql` to `/docker-entrypoint-initdb.d` as a read-only init directory. On first startup with an empty `postgres_data` volume, the official PostgreSQL image runs the scripts in filename order:

1. `001_schema.sql`
2. `002_seed.sql`

This creates the local `anatolearn` database schema and seed data automatically for new project setups. The init scripts do not rerun when an existing database volume is present.

> Status: **Draft — database not yet built.** Based on Task 1.2's original table list, updated with confirmed requirements from 'Project Details Reference' tab under ITP Google Doc, and gaps found while reviewing the actual frontend (`Quizzes.tsx`, `Videos.tsx`). For Member B's review before creating tables — not a final, locked spec.

---

## `users`
No changes from original Task 1.2 spec. **Status: Not built** — no `users` table exists yet, no auth (Task 9 not built).

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| name | text | |
| email | text | unique |
| password_hash | text | |
| role | text | 'student' or 'teacher' |
| program | text | Physiotherapy / Occupational Therapy / Radiography / Nursing |
| created_at | timestamp | |

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

**Status: Built as `models` (renamed from `anatomy_models`), diverges from this proposal.** No `file_format`, `body_system`, `body_part`, `is_published`, or `uploaded_by` columns exist. Actual columns: `id`, `program_id` (references `programs.id`), `title`, `description`, `file_path`, `thumbnail_path`, `created_at`, `updated_at`. Uses `program_id` rather than free-text `body_system`/`body_part`. **Still no publish gating for models** — only `videos` and `quizzes` have `is_published` so far (see below). Models are viewed via a `ModelGallery.tsx` page (browsing) and `Viewer.tsx` (individual model + annotations), both confirmed working — see the `annotations` section below for how the 3D viewer actually works.

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

**Status: Built, diverges from this proposal, updated 15 Jul 2026.** Actual columns: `id`, `program_id` (references `programs.id`), `title`, `description`, `video_path` (not `file_path`), `thumbnail_path` (not `thumbnail`), `is_published` (**added this session**, matches this proposal), `created_at`. No `category`, `linked_label_id`, or `uploaded_by` columns exist — since there's no `labels` table (see above), `linked_label_id` was never viable as originally proposed, and this remains an open architecture question rather than a simple gap to fill in.

| Column (as built) | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| program_id | integer, nullable | references programs.id, ON DELETE SET NULL |
| title | varchar(255) | not null |
| description | text | |
| video_path | text | not null |
| thumbnail_path | text, nullable | |
| is_published | boolean | not null, default false — **added 15 Jul 2026** |
| created_at | timestamp | default CURRENT_TIMESTAMP |

---

## Static file serving — bug found and fixed (15 Jul 2026)

Uploaded video files (and previously, model thumbnails) were being correctly saved to disk under `PUBLIC_DIR` (`/public` in the container), but **Express had no `express.static` middleware serving that directory at all**. This meant every `video_path` and `thumbnail_path` URL stored in the database (e.g. `/videos/s.mp4`) was a dead link — the file physically existed, but requesting its URL returned a 404. This predates this session's work; it affected the original seeded video and any model thumbnails generated by `Viewer.tsx` since Member B first built that feature.

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
**Status: Built, diverges from original proposal in two ways.** No `student_id` (blocked on Task 9, auth). Also adds a `status` field not in the original proposal, to support the manual-review flow this section originally asked about.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | primary key |
| quiz_id | integer | references quizzes.id, ON DELETE CASCADE |
| score | integer, nullable | percentage 0-100; **null while status = 'pending_review'** |
| total_questions | integer | not null |
| correct_count | integer, nullable | MCQ correct count; null while pending review |
| status | attempt_status enum | 'graded' / 'pending_review', default 'graded' |
| attempted_at | timestamp | default CURRENT_TIMESTAMP |

An attempt becomes `pending_review` if it contains **any** open-ended answers. MCQ portions are still auto-graded and stored immediately (per-answer, in `quiz_attempt_answers`), but the attempt's overall `score` stays null until every open-ended answer in it has been manually scored by a teacher.

**Divergence from original plan:** `student_id` is missing — this is a real gap, not a deliberate design choice. Every attempt is currently anonymous. Task 8.8 (quiz history) cannot be built until Task 9 (auth) exists and `student_id` is added as a follow-up migration.

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
No changes from original Task 1.2 spec. **Status: Not built** — no download endpoints exist yet (Task 10.1).

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| model_id | uuid / int | references anatomy_models.id |
| downloaded_by | uuid / int | references users.id |
| downloaded_at | timestamp | |

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

---

## Questions

1. **Scoring open-ended (Practical) answers:** MCQ questions can be auto-graded (compare `correct_option` to student's selected answer). Open-ended questions have no fixed correct answer to compare against — does grading require a teacher to manually review and assign a score, or is there an auto-grading approach planned? This affects whether `quiz_attempts.score` can always be calculated immediately on submit, or sometimes needs to stay null/pending until a teacher reviews it.
- Suggestion: teacher manually review and assign score.
- Reason: Open-ended answers have no single correct answer to auto-check against — free text can't be reliably graded by comparing it to a model_answer.
- Manual review is simpler and more accurate than trying to auto-grade it.
- **Resolved.** Teacher manually reviews and assigns a 0-100 score per open-ended answer via `PATCH /api/attempt-answers/:id/grade`, through a dedicated "View Results" grading UI. Matches the original suggestion above. See `quiz_attempt_answers` for the implementation. Once every open-ended answer in an attempt is scored, the final blended score is computed automatically and `status` flips from `pending_review` to `graded`.

2. **Student attribution on `quiz_attempts`:** blocked on Task 9 (auth/`users` table). Once auth exists, `quiz_attempts` needs a `student_id` column added via migration, and `POST /api/quizzes/:id/submit` needs to accept/derive the authenticated student's ID. **Interim workaround (15 Jul 2026):** the frontend stores the attempt id in `sessionStorage` keyed by quiz id after submission, so a student can see their graded result if they revisit the same quiz in the same browser. This is not real student attribution — it doesn't survive a different device, a cleared cache, or a different student using the same browser. See `docs/api_endpoints.md` for the full caveat.

3. **Video-to-annotation linking (new, 15 Jul 2026):** `tasks.md` Tasks 7.5/7.6 describe linking a video to a "label," but the actual 3D viewer implementation uses `annotations`, not `labels` — there is no video field anywhere in the annotation data model. Needs a decision from the team on whether to (a) add a nullable `video_id` to `annotations` and build a teacher UI to attach a video when creating/editing an annotation, or (b) treat this as out of scope given the architecture divergence. Not yet decided.