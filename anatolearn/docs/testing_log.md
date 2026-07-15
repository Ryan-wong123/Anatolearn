# Testing Log

## Docker PostgreSQL Init Script Mount
Date: 8 Jul 2026
Tester: Codex

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
Tester: Natalie

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

**This does NOT yet confirm that AnatoLearn's own in-app video player works correctly** — that requires Task 7.4 (VideoPlayer component) and Task 7.3 (click-to-play wiring) to be built first, followed by a re-test inside the actual app (including the modal/player UI, controls, and any file-size or upload-related edge cases).

---

## Task 8.3/8.5/8.6/8.7 — Quiz Creation, Attempt, and Scoring Flow
Date: 15 Jul 2026
Tester: Natalie

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
Tester: Natalie

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
Tester: Natalie

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