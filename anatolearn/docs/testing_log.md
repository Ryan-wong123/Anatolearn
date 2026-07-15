# Testing Log

## Docker PostgreSQL Init Script Mount
Date: 8 Jul 2026
Tester: Member B

### Test Method
Updated `docker-compose.yml` so the Postgres service mounts `backend/sql` to `/docker-entrypoint-initdb.d` as read-only. Validated the Docker Compose file with `docker compose config`.

### Expected Behavior
On first startup with an empty `postgres_data` volume, the official PostgreSQL image runs `001_schema.sql` and then `002_seed.sql`, creating and seeding the `anatolearn` database automatically.

### Results
Pass. `docker compose config` accepted the compose file and resolved the init mount to `/docker-entrypoint-initdb.d:ro`.

### Notes
The init scripts only run automatically when the PostgreSQL data volume is empty. Existing local volumes keep their current database contents and require a deliberate `docker compose down -v` reset before init scripts rerun.

---

## Task 7.7 — Video Playback Compatibility Test
Date: 15 Jun 2026
Tester: Member C

### Test Method
Tested using a standalone HTML file (outside the AnatoLearn codebase) with native HTML5 `<video>` elements — NOT tested within the actual AnatoLearn app, since the in-app VideoPlayer component (Task 7.4) and click-to-play wiring (Task 7.3) are not yet built. Test files were a YouTube video converted to `.mp4` and `.webm`.

### Test Environment
- Microsoft Edge Version: 149.0.4022.69 (Official Build) (64-bit)
- Google Chrome Version: 149.0.7827.103 (Official Build) (64-bit)
- Firefox Version: 151.0.4 (64-bit)
- OS: Windows

### Test Files
- test.mp4
- test.webm

### Results

| Format | Chrome | Firefox | Edge |
|---|---|---|---|
| .mp4   | Pass   | Pass    | Pass |
| .webm  | Pass   | Pass    | Pass |

### Notes
Both .mp4 and .webm formats loaded and played correctly across all three browsers using native HTML5 `<video>` controls (play, pause, seek, volume). No buffering issues or playback errors observed.

### Conclusion
Chrome, Firefox, and Edge all support native HTML5 playback of `.mp4` and `.webm` formats, confirming the browser-level format support AnatoLearn can rely on.

**Update 15 Jul 2026: Task 7.4's real VideoPlayer.tsx now exists and was confirmed working in-app (see entry below) — this standalone test's original caveat about not verifying the actual app player no longer applies.**

---

## Task 8.3/8.5/8.6/8.7 — Quiz Creation, Attempt, and Scoring Flow
Date: 15 Jul 2026
Tester: Member C

### Test Method
Manual testing through the running app (`http://localhost:5173`) as both Teacher and Student roles, cross-checked against the database via `docker compose exec postgres psql`.

### Test Environment
- Local Docker Compose stack (frontend, backend, postgres)
- Chrome

### Results

| Flow | Result |
|---|---|
| Teacher creates a quiz (title/description/type/category) | Pass |
| Teacher adds multiple questions to a newly created quiz | Pass |
| Teacher edits a question before finishing quiz creation | Pass |
| Teacher deletes a question before finishing quiz creation | Pass |
| Cancelling quiz creation with zero questions added deletes the abandoned quiz | Pass — verified via `GET /api/quizzes`, quiz no longer listed |
| Finishing quiz creation publishes the quiz (`is_published: true`) | Pass |
| Student view only shows published quizzes | Pass — unpublished quizzes correctly hidden via `?published=true` |
| `GET /api/quizzes/:id/questions` no longer returns `correct_option` | Pass — verified in browser DevTools Network tab response |
| Student completes a quiz and submits | Pass |
| Score computed server-side via `POST /api/quizzes/:id/submit` | Pass |
| Attempt persisted to `quiz_attempts` table | Pass — verified via direct SQL query, 2 attempts recorded with correct `quiz_id`/`score`/`total_questions`/`correct_count` |
| Results screen shows correct score % and per-question feedback | Pass |
| Retry resets quiz state correctly | Pass |

### Notes
- Test data (13 throwaway quizzes created during development) was cleaned up via `DELETE /api/quizzes/:id` before final verification — only the 3 seeded quizzes plus genuinely created test quizzes remain.
- Known gap identified in this session, resolved in the next: Practical/Mixed quiz types rendered identical MCQ question forms — no open-ended question format existed in the schema at this point. See the following entry.
- Known gap: `quiz_attempts` has no `student_id`, so attempts are anonymous. Blocked on Task 9 (auth). Still unresolved as of the next entry below.

---

## Task 8.1/8.2/8.6/8.7 (extended) — Open-Ended Question Support
Date: 15 Jul 2026
Tester: Member C

### Test Method
Manual testing through the running app as both Teacher and Student roles, plus direct API calls via `Invoke-RestMethod` to verify response shape (specifically, that `model_answer`/`correct_option` are never sent to students).

### Test Environment
- Local Docker Compose stack (frontend, backend, postgres)
- Chrome

### Results

| Flow | Result |
|---|---|
| Schema migration (new enums, nullable MCQ columns, `quiz_attempt_answers` table) applied via full db rebuild | Pass |
| Teacher creates an open-ended question via `POST /api/quizzes/:id/questions` with `format: "open_ended"` | Pass |
| `GET /api/quizzes/:id/questions` excludes both `model_answer` and `correct_option` for open-ended and MCQ questions | Pass — verified via direct API call |
| Teacher can toggle between MCQ and Open Ended format when adding a question | Pass |
| Teacher can create a quiz mixing MCQ and open-ended questions | Pass |
| Quiz type badge auto-derives correctly (MCQ / Practical / Mixed) based on question formats present | Pass |
| Student sees a text box (not radio buttons) for open-ended questions | Pass — fixed a bug where open-ended questions initially rendered as blank MCQ radio buttons |
| Student submission with any open-ended answer returns `status: "pending_review"` and `score: null` | Pass |
| Results screen shows "Submitted — Pending Review" instead of a score when pending | Pass |

### Notes
- **Known gap, resolved in the next entry:** no teacher-facing UI existed yet to view pending attempts or grade open-ended answers. Backend endpoints were built but only reachable via direct API calls at this point.
- Test data from earlier sessions was not retained across this schema migration (full `docker compose down -v` rebuild) — only the 3 seeded quizzes remain as baseline content.

---

## Task 8.6 (bugfix) + Teacher Grading UI — Open-Ended Scoring & Review Flow
Date: 15 Jul 2026
Tester: Member C

### Test Method
Manual testing through the running app as both Teacher and Student roles across three separate graded scenarios to isolate a scoring bug, then a full end-to-end retest after the fix.

### Test Environment
- Local Docker Compose stack (frontend, backend, postgres)
- Chrome

### Bug Found and Fixed
Weighted score calculation in `PATCH /api/attempt-answers/:id/grade` divided MCQ-correct count by total question count instead of MCQ question count, understating the MCQ contribution to the blended score. Example: 1/1 MCQ correct + 3 open-ended scored 100 each returned 81% instead of the correct 100%. Fixed by dividing by `mcqCount`. Re-verified with three scenarios (all correct, MCQ correct/open-ended wrong, MCQ wrong/open-ended correct) — all now compute correctly.

### Results

| Flow | Result |
|---|---|
| Teacher opens "View Results" on a quiz with a pending attempt | Pass |
| Teacher can drill into a specific pending attempt and see student answers alongside model answers | Pass |
| Teacher assigns a 0-100 score to each open-ended answer | Pass |
| Attempt auto-transitions from pending_review to graded once all open-ended answers are scored | Pass |
| Weighted score calculation (post-fix) matches expected math across 3 test scenarios | Pass |
| Results screen shows per-question feedback for both MCQ (auto-graded) and open-ended (teacher-graded) questions | Pass |
| sessionStorage workaround: student sees "Awaiting teacher review" immediately after submitting, then sees the actual graded result (including per-question open-ended scores) when revisiting the same quiz in the same browser after teacher grading | Pass |

### Notes
- The sessionStorage-based result visibility is an explicitly documented stopgap, not real quiz history — see `docs/api_endpoints.md` for the limitation note. Task 8.8 and real student attribution remain blocked on Task 9 (auth).
- Removed a results-screen summary sentence ("MCQ: X/Y correct · N open-ended reviewed") after review — deemed redundant given the per-question feedback cards below it already convey the same information more clearly.

---

## Codebase Audit — 3D Viewer, Video Player, and Team Alignment
Date: 15 Jul 2026
Tester: Member C

### Context
Before starting Task 7.1 (video upload), reviewed the group chat and a private chat with Member B to confirm current task ownership and avoid duplicating work. Two significant findings:

1. **The person referred to informally as "Tim" and Member B are the same person** — not two separate teammates. Member B's last detailed technical update was 8 Jul 2026; no reply since a 13 Jul check-in asking what they'd worked on.
2. **The actual codebase is substantially further along than `tasks.md` reflected**, because Member B's work was never fully documented back into the checklist. Pulled and reviewed `Viewer.tsx`, `Videos.tsx`, `VideoPlayer.tsx`, `ModelGallery.tsx`, and `App.tsx` directly rather than trusting stale checkboxes.

### Findings

| File | Status found | Notes |
|---|---|---|
| `Viewer.tsx` | Substantially built | Full annotation system (point/draw/region), teacher add/edit/delete modes, persistent CRUD to backend, camera framing, thumbnail auto-generation. Diverges significantly from the `labels`-based design originally in `Architecture.md`/`design.md` — see `docs/database_schema.md` open question #3. |
| `ModelGallery.tsx` | Exists | Not reviewed in detail this session — referenced by `App.tsx` routing (`/3dviewer`) but file contents not pulled. |
| `Videos.tsx` | Real, working (pre-session) | Fetched from `GET /api/videos`, working search, links to detail page. Upload was an explicit stub ("Upload flow not wired yet") before this session's work. |
| `VideoPlayer.tsx` | Real, working (pre-session) | Full HTML5 `<video>` player with controls, autoplay, poster thumbnail, back navigation. Confirms Task 7.3 and 7.4 were already functionally complete before this session touched anything. |
| `App.tsx` | Confirmed routing | `/3dviewer` → `ModelGallery`, `/3dviewer/:modelId` → `Viewer`, `/videos` → `Videos`, `/videos/:videoId` → `VideoPlayer`. |

### Conclusion
`tasks.md` significantly understated progress on Weeks 2/3/5 (3D viewer) and Task 7.3/7.4 (video browsing/playback) — these are functionally complete, just implemented differently than the original task descriptions assumed, and the checklist was never updated to reflect Member B's work. `tasks.md` has been corrected accordingly in this update. Going forward, before assuming a task is unbuilt, pull and check the actual current file rather than trusting the checkbox.

---

## Task 7.1/6.2/6.4 — Video Upload, Publish Toggle, Edit, Delete
Date: 15 Jul 2026
Tester: Member C

### Test Method
Manual testing through the running app as Teacher and Student roles, plus direct `Invoke-RestMethod` calls (PowerShell 7, upgraded from 5.1 mid-session to support `-Form` multipart uploads) to verify the upload endpoint in isolation before building the frontend form.

### Test Environment
- Local Docker Compose stack (frontend, backend, postgres)
- Chrome (app testing), PowerShell 7.6.3 (API testing)

### Bug Found and Fixed
`express.static` was never configured — see `docs/database_schema.md` "Static file serving" section for the full writeup. This was a pre-existing bug (predates this session), not something introduced by the upload work, but it was blocking video playback entirely and had to be fixed before upload testing could be considered meaningful.

### Results

| Flow | Result |
|---|---|
| Schema migration: `is_published` added to `videos` | Pass |
| `POST /api/videos/upload` — direct API test via `Invoke-RestMethod -Form` | Pass — created video with correct `video_path`, `is_published: false` |
| Uploaded file confirmed present on disk at `/public/videos/` | Pass |
| Static file serving fix confirmed via direct browser URL load | Pass |
| `DELETE /api/videos/:id` | Pass |
| `PATCH /api/videos/:id/publish` | Pass (via UI, see below) |
| `PUT /api/videos/:id` | Pass (via UI, see below) |
| `GET /api/videos?published=true` filters correctly | Pass |
| Teacher: real Upload Video form (title, description, file picker) replaces old stub | Pass |
| Newly uploaded video shows "Unpublished" badge | Pass |
| Teacher: Publish/Unpublish toggle on video card | Pass |
| Teacher: Edit modal (title, description) | Pass |
| Teacher: Delete with confirmation | Pass |
| Student: unpublished videos correctly hidden; published videos visible | Pass |

### Notes
- PowerShell 5.1 (default on Windows) does not support `Invoke-RestMethod -Form` for multipart uploads — required upgrading to PowerShell 7 via `winget install --id Microsoft.PowerShell` mid-session.
- `DELETE /api/videos/:id` removes the database row only, not the file from disk — flagged as a known gap in `docs/api_endpoints.md`.
- Test video and its file were not manually cleaned from disk after testing (only the DB row was deleted) — low priority, but noted in case disk usage becomes relevant later.