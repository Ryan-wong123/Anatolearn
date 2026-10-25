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
| .mp4 | Pass | Pass | Pass |
| .webm | Pass | Pass | Pass |

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
- Known gap identified in this round, resolved in the next: Practical/Mixed quiz types rendered identical MCQ question forms — no open-ended question format existed in the schema at this point. See the following entry.
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
- The sessionStorage-based result visibility is an explicitly documented stopgap, not real quiz history — see `api_endpoints.md` for the limitation note. Task 8.8 and real student attribution remain blocked on Task 9 (auth).
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
| `Viewer.tsx` | Substantially built | Full annotation system (point/draw/region), teacher add/edit/delete modes, persistent CRUD to backend, camera framing, thumbnail auto-generation. Diverges significantly from the `labels`-based design originally in `Architecture.md`/`design.md` — see `database_schema.md` open question #3. |
| `ModelGallery.tsx` | Exists | Not reviewed in detail this round — referenced by `App.tsx` routing (`/3dviewer`) but file contents not pulled. |
| `Videos.tsx` | Real, working (pre-session) | Fetched from `GET /api/videos`, working search, links to detail page. Upload was an explicit stub ("Upload flow not wired yet") before this round's work. |
| `VideoPlayer.tsx` | Real, working (pre-session) | Full HTML5 `<video>` player with controls, autoplay, poster thumbnail, back navigation. Confirms Task 7.3 and 7.4 were already functionally complete before this round touched anything. |
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
`express.static` was never configured — see `database_schema.md` "Static file serving" section for the full writeup. This was a pre-existing bug (predates this round), not something introduced by the upload work, but it was blocking video playback entirely and had to be fixed before upload testing could be considered meaningful.

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
- `DELETE /api/videos/:id` removes the database row only, not the file from disk — flagged as a known gap in `api_endpoints.md`.
- Test video and its file were not manually cleaned from disk after testing (only the DB row was deleted) — low priority, but noted in case disk usage becomes relevant later.
---

## Task 9.1 — User Registration API
Date: 20 Jul 2026
Tester: 

### Test Method
Ran a real local Postgres instance (schema + seed + new `003_add_users.sql` migration applied), started `server.js` against it, and hit `POST /api/auth/register` directly with `curl` for 5 cases, then verified the database row directly with `psql`.

### Test Environment
- Local Postgres 16 + Node backend, outside Docker (sandboxed test environment, not the team's Docker Compose stack — recommend re-confirming once with `docker compose up --build` too)
- `curl` for API calls, `psql` for direct db verification

### Results

| Case | Expected | Result |
|---|---|---|
| Valid registration (teacher role) | 201, no `password_hash` in response | Pass |
| Duplicate email (case-different: `Jane@Example.com` vs `jane@example.com`) | 409 | Pass — confirms email normalization (lowercase/trim) works before the uniqueness check |
| Missing password | 400 | Pass |
| Invalid role (`"admin"`) | 400 | Pass |
| Password under 8 characters | 400 | Pass |
| DB row check | `password_hash` stored as a 60-char bcrypt hash, never returned by the API | Pass |

### Notes
- `bcryptjs` (pure JS) was used instead of native `bcrypt` to avoid native-module build issues inside the Docker container — same hash format, same security properties, just no compiled binary dependency.
- `003_add_users.sql` is additive-only (no `DROP TABLE`), unlike `001_schema.sql` — written this way so it's safe to run against the team's existing dev database without wiping other tables. See the file's header comment for the exact `docker compose exec` command to apply it manually.
- Login (Task 9.2), auth middleware (9.3), and the frontend `Login`/`Register`/`ProtectedRoute` pages (9.4-9.6) are still outstanding — registration alone does not protect anything yet.
- Not yet tested inside the actual Docker Compose stack — recommend a quick confirmation pass there before considering 9.1 fully closed, since the sandboxed test environment used here isn't identical (e.g. Postgres version/config could theoretically differ slightly from the `postgres:16` image).

---

## Task 9.2 — Login + JWT API
Date: 20 Jul 2026
Tester: 

### Test Method
Reused the same local Postgres + backend setup from the Task 9.1 test session (existing `jane@example.com` / teacher account from that session), hit `POST /api/auth/login` with `curl` for 5 cases, and manually verified the JWT payload and expiry.

### Test Environment
- Local Postgres 16 + Node backend, outside Docker (same sandboxed setup as the 9.1 test)
- `curl` for API calls

### Results

| Case | Expected | Result |
|---|---|---|
| Correct email + password | 200, `token` + `user` object, no `password_hash` | Pass |
| Wrong password | 401, generic `"Invalid email or password"` | Pass |
| Non-existent email | 401, **identical** message to wrong-password case | Pass — confirms the endpoint doesn't leak which emails are registered |
| Missing password field | 400 | Pass |
| Email case-insensitivity (`Jane@EXAMPLE.com`) | 200, same as canonical email | Pass |
| JWT expiry | `exp - iat` = 86400 seconds (24h) | Pass — decoded and checked manually |

### Notes
- Confirmed separately, in the actual Docker Compose environment, that Task 9.1 (registration) works end-to-end — see the Task 9.1 entry above. Task 9.2 was tested in the sandboxed environment only so far; recommend the same real-environment confirmation pass before considering it fully closed, same caveat as 9.1.
- The JWT is signed but nothing currently validates it on any other route — Task 9.3 (auth middleware) is what makes this actually protect anything. Right now, anyone with a valid *or* invalid token (or no token at all) can still hit every existing endpoint.
- Discovered and fixed a real deployment gotcha during the 9.1 rollout, worth keeping in mind for any future dependency changes: adding a package to `backend/package.json` is not enough on its own. Docker Compose's anonymous `node_modules` volume (`- /app/node_modules` in `docker-compose.yml`) persists across plain rebuilds, so `docker compose up --build` alone kept using stale `node_modules` without the new packages. Fix was `docker compose up --build --renew-anon-volumes backend`. Documented here so the next dependency change doesn't hit the same wall.

---

## Task 9.3 — Auth Middleware (authenticate + requireTeacher)
Date: 20 Jul 2026
Tester: 

### Test Method
Reused the same local Postgres + backend setup from the 9.1/9.2 test sessions. Registered a second test user (`sam@example.com`, student role) alongside the existing `jane@example.com` (teacher), logged in as both to get real JWTs, then ran a 9-case matrix with `curl` covering: no token, valid student token, valid teacher token, garbage token, and a malformed header, against both public and protected routes.

### Test Environment
- Local Postgres 16 + Node backend, outside Docker (same sandboxed setup as 9.1/9.2)
- `curl` for API calls, tokens extracted via `python3 -c "...json.load..."`

### Results

| Case | Expected | Result |
|---|---|---|
| `GET /api/models`, no token | 401 | Pass |
| `GET /api/models`, student token | 200 | Pass |
| `POST /api/quizzes`, student token | 403 (teacher-only) | Pass |
| `POST /api/quizzes`, teacher token | 201 | Pass |
| `DELETE /api/models/:id`, student token | 403 | Pass |
| `GET /api/models`, garbage/invalid token | 401 | Pass |
| `GET /api/health`, no token | 200 (public route unaffected) | Pass |
| `GET /api/programs`, no token | 200 (public — Register page needs this pre-login) | Pass |
| `GET /api/models`, malformed header (missing `Bearer ` prefix) | 401 | Pass |

### Bug Found and Fixed (self-caught during implementation, before any real testing)
The automated script used to add `authenticate`/`requireTeacher` to all 35 protected routes had a regex bug that dropped the trailing newline from each edited line, silently merging it with the next line's code (e.g. `app.get(...) => { const { published } = req.query;` all on one line instead of two). Caught immediately via `node --check` output looking suspicious combined with a manual `view` of the file, before any test traffic was sent. Fixed by restoring the pre-patch file from the previous session's delivered zip and re-running the corrected script. Full `diff` against the pre-patch version afterward confirmed only the intended 36 lines changed and nothing else moved.

### Notes
- **Important, not yet resolved:** `src/api/api.ts` sends no `Authorization` header on any request, and there's no logged-in state yet (`Login.tsx` is a stub). This means the currently-running frontend (Dashboard, Videos, Quizzes, Library, 3D Viewer — everything) will start receiving 401s on every page the moment this backend change is deployed. This is expected given the task sequence (9.4-9.6 are the frontend wiring), but it's a real, visible breakage, not just a documentation gap — see `api_endpoints.md`'s Auth section for the full note.
- Two routes were classified as `authenticate`-only rather than `requireTeacher` as judgment calls, not explicit spec: `PATCH /api/models/:id/thumbnail` (auto-triggered for any viewer, not just teachers) and `GET /api/attempts/:id` / `GET /api/attempts/:id/answers` (used by both the teacher grading UI and the student sessionStorage result-check workaround). See `api_endpoints.md` for the reasoning.
- Only tested in the sandboxed environment so far, not yet re-confirmed in the team's actual Docker stack — same caveat as 9.1/9.2, though 9.1 and 9.2 were both since confirmed there.

---

## Tasks 6.5, 6.6, 9.4, 9.6, 9.7 — Frontend Auth Wiring (Login, ProtectedRoute, Logout, Real Role Source)
Date: 20 Jul 2026
Tester: 

### Test Method
Static/build-level verification only this round — no running browser session against a live backend yet (that's the recommended next step, same pattern as the backend auth tasks before real-environment confirmation).

- `npx tsc --noEmit -p tsconfig.app.json` — full project type check
- `npx eslint` on all 5 changed files
- `npm run build` — real production Vite build
- Manual diff of `api.ts`'s method names before/after the rewrite (extracted every top-level method key from both versions and compared) to confirm no existing method was accidentally dropped or renamed while adding the shared `apiFetch` helper
- Inspected the actual built JS bundle to confirm `import.meta.env.DEV` compiles to a hardcoded `isDevMode:!1` (i.e. `false`) in production, not just "probably works"

### Results

| Check | Result |
|---|---|
| `tsc --noEmit` | Pass — 0 errors |
| `eslint` on the 5 changed files | Pass — 0 errors (1 pre-existing warning in `AppContext.tsx`, confirmed present in the file *before* any of this round's changes too, not introduced by this work) |
| `npm run build` | Pass — builds cleanly, no new warnings beyond a pre-existing bundle-size notice unrelated to these changes |
| All 35 original `api.ts` method names preserved after the `apiFetch` rewrite | Pass — confirmed via diff, only `login` and `register` added |
| Production build's `isDevMode` value | Confirmed `false` (`isDevMode:!1`) in the actual built bundle — the Student/Teacher nav toggle cannot function outside `npm run dev` |

### Bug Found and Fixed
None this round — the Task 9.3 route-merging bug (previous entry) was the one caught-and-fixed incident; this round's changes passed type-check, lint, and build cleanly on the first attempt.

### Notes
- **Not yet tested:** an actual login → dashboard → logout cycle in a real browser against the real running backend. Build-level checks confirm the code is well-formed and internally consistent, but not that the UX actually works end-to-end (e.g. whether the error message renders correctly, whether the program dropdown really syncs after login, etc.). Recommend testing this in the real Docker environment before considering these tasks fully closed, same pattern as every other task this round.
- `Register.tsx` is still a stub — the new Login page's "Register" link will currently land on a placeholder. Task 9.5 is the natural next piece of work.
- Task 6.5 was marked done retroactively in `tasks.md` — it's the same middleware already built and tested under Task 9.3 in the previous session, just re-labeled to match the actual task numbering in the spec (Task 9.3 explicitly depends on 6.5 and describes the same work). No new code, just a checklist correction.

---

## Real-Environment Confirmation — Tasks 6.5, 6.6, 9.4, 9.6, 9.7
Date: 20 Jul 2026
Tester: 

### Test Method
Manual testing in the actual Docker Compose environment (not the sandboxed setup used to build/verify these tasks), via the real browser UI at `http://localhost:5173`.

### Results

| Flow | Result |
|---|---|
| Login with valid credentials | Pass — redirects to `/dashboard` |
| Login with wrong password | Pass — shows error message |
| Login with wrong/unregistered email | Pass — shows error message |
| Logout | Pass — returns to `/login` |
| Visiting `/dashboard` directly while logged out | Pass — correctly redirected, dashboard does not render |

### Notes
This closes the loop on the "not yet tested against a real browser session" caveat noted in the previous entry for these same tasks — all previously-build-level-only verification is now also confirmed working end-to-end in the real environment.

---

## Task 9.5 — Registration Page (Frontend)
Date: 20 Jul 2026
Tester: 

### Test Method
Same verification pattern as the Task 9.4 frontend round: `tsc --noEmit`, `eslint`, and a full `npm run build`, plus (going one step further than 9.4's initial round) a direct API-level test confirming the exact payload shape the form sends round-trips correctly.

### Test Environment
- `tsc`/`eslint`/`vite build` — local, no server needed
- API round trip — local Postgres 16 + Node backend, outside Docker (same sandboxed setup as the backend auth tests)

### Results

| Check | Result |
|---|---|
| `tsc --noEmit` | Pass — 0 errors |
| `eslint src/pages/Register.tsx` | Pass — 0 errors |
| `npm run build` | Pass |
| `POST /api/auth/register` with the exact payload shape the form sends (`program_id` as a number, from converting the select's string value) | Pass — 201, account created |
| Immediately logging in with the newly registered account | Pass — 200, real token returned |

### Notes
- Not yet clicked through in an actual browser — recommend the same real-environment confirmation already did for Login/Logout/ProtectedRoute (see the "Real-Environment Confirmation" entry above) before fully closing this out: fill the form, submit, confirm redirect to `/login`, then log in with the new account.
- Client-side password length validation (≥8 chars) was added ahead of the API call, matching the backend's own rule — means the error shows instantly instead of waiting on a round trip for something the frontend can already catch.

---

## Real-Environment Confirmation — Task 9.5 (Register)
Date: 20 Jul 2026
Tester: 

### Test Method
Manual testing in the actual Docker Compose environment via the real browser UI at `http://localhost:5173/register`.

### Results

| Flow | Result |
|---|---|
| Register page renders correctly (name, email, password, role dropdown, program dropdown with 4 real choices, Create account button, Sign in link) | Pass |
| Submitting the form with a new test account | Pass |

### Notes
This closes out the last remaining "not yet clicked through in a real browser" caveat for Week 9 — every task in the auth chain (6.5, 6.6, 9.1-9.7) is now confirmed working end-to-end in the real environment, not just at the build/sandbox level.

---

## Tasks 4.1/4.3/4.4 and 10.1/10.2/10.3 — Search/Filter and Download/Export
Date: 20 Jul 2026
Tester: 

### Test Method
Real Postgres + backend, tested via `curl` with real teacher and student JWTs, plus static verification (`tsc`, `eslint`, `npm run build`) for the frontend pieces. Migration applied fresh to a real Postgres instance and confirmed clean (`ALTER TABLE` × 2, `CREATE TABLE` × 1, no errors).

### Test Environment
- Local Postgres 16 + Node backend, outside Docker (same sandboxed setup as all Week 9 backend tests)
- `curl` for API calls
- `tsc --noEmit`, `eslint`, `npm run build` for frontend verification

### Results — Search/Filter (4.1/4.3/4.4)

| Case | Expected | Result |
|---|---|---|
| Edit a model to set `body_system`/`body_part` | 200, fields persisted | Pass |
| `?system=Cardiovascular` | Only matching model(s) returned | Pass |
| `?q=A1` (keyword search) | Matches both `A1` and `A1 Copy` | Pass |
| `?q=<nonsense>` (no matches) | `[]` with 200, not 404 | Pass |
| No query params at all (regression) | All models, unchanged from before this round | Pass |
| `?published=true` alone (regression) | Same 3 published models as before | Pass |
| `?system=&part=&q=` combined | Correctly narrows to the single matching model | Pass |

### Results — Download/Export (10.1/10.2/10.3)

| Case | Expected | Result |
|---|---|---|
| Student downloads a published model | 200, correct filename (`A1.glb`) and `Content-Type` (`model/gltf-binary`), file content matches disk | Pass |
| Student attempts to download an unpublished model | 403 | Pass |
| Teacher downloads an unpublished model | 200 (teachers unrestricted) | Pass |
| Download logged to `downloads` table | Correct `model_id`/`downloaded_by` for both the student and teacher download | Pass |
| Export annotations as JSON (teacher) | Valid JSON, full annotation rows | Pass |
| Export annotations as CSV (teacher), including a description with an embedded quote and a comma | Properly escaped per CSV rules (RFC 4180-style doubled quotes, quoted field) | Pass |
| Student attempts annotation export | 403 (teacher-only) | Pass |
| `tsc --noEmit` | 0 errors | Pass |
| `eslint` on all changed files | 0 errors | Pass |
| `npm run build` | Clean | Pass |

### Bugs Found and Fixed
1. **CSV timestamp double-encoding.** First implementation ran every non-null value through `JSON.stringify()` if `typeof value === 'object'`, which also caught `Date` objects (`created_at`), producing an already-quoted JSON string that then got quote-escaped *again* by the CSV logic — resulting in triple-quoted timestamps (`"""2026-07-20T10:29:37.960Z"""`). Fixed by special-casing `Date` instances to use `.toISOString()` before the CSV-escaping step. Caught by manually inspecting the raw CSV output, not by an automated check — worth remembering that quiet formatting bugs like this don't surface in a 200-status/passes-schema-validation kind of test.
2. **Pre-existing lint error in `ModelGallery.tsx`**, unrelated to this round's new work but found while touching the file: `loadModels` was referenced inside a `useEffect` before its own `const` declaration further down the file. Not a runtime bug (the effect doesn't execute until after the whole component function body runs, so `loadModels` is already defined in the closure by the time it's called) but flagged by the project's ESLint config. Fixed by moving the function declaration above the effect that uses it.
3. **Design decision course-correction:** an initial version of the system/part filter interaction reset the part filter using a second `useEffect` that called `setState` inside its body — this trips the project's `react-hooks/set-state-in-effect` rule (a newer React Compiler–oriented lint rule, not present when most of the existing codebase was written, so this is the first time it's come up). Reworked to do the reset directly inside the system dropdown's `onChange` handler instead, which avoids the anti-pattern entirely rather than suppressing the lint rule.

### Notes
- All of this is confirmed working against a real backend in a sandboxed test environment, but **not yet confirmed in the actual Docker Compose environment or a real browser** — same "next step" pattern as every other task this round. The migration (`004_add_model_fields_and_downloads.sql`) needs to be applied there before any of this will work.
- Download UI shows a per-model disabled/loading state (`downloadingId`/`exportingId`) rather than a generic global spinner, so downloading one model doesn't visually disable buttons on unrelated model cards.

---

## Real-Browser Bug — Download Filename (CORS header exposure)
Date: 20 Jul 2026
Tester: 

### What happened
After confirming search/filter worked in a real browser, Tested the download button on a model card. The file downloaded successfully and contained genuinely correct model data (confirmed by inspecting it — real glTF JSON structure, `accessors`/`bufferView`/vertex data), but saved with the generic filename `download` instead of the expected `A1.glb`.

### Root Cause
`Content-Disposition` (which carries the real filename) is not in the browser's default cross-origin-readable response header allowlist. The frontend (`localhost:5173`) and backend (`localhost:5000`) are different origins, so this is a real cross-origin request subject to CORS rules. The header was genuinely present in every server response (confirmed via `curl -i` with an `Origin` header to simulate the browser's request — `Content-Disposition: attachment; filename="A1.glb"` was right there), but browser JavaScript (`fetch()` in `api.ts`) couldn't see it without the server explicitly exposing it via `Access-Control-Expose-Headers`.

This is why it passed every `curl`-based test earlier in the session (see the Task 10.1/10.2 entry above) — `curl` doesn't enforce CORS, so the exact same requests that "worked" from the command line were silently broken from a real browser the whole time.

### Fix
Added `exposedHeaders: ['Content-Disposition']` to the backend's global `cors()` middleware in `server.js`. Confirmed via `curl -i` with a simulated `Origin` header that `Access-Control-Expose-Headers: Content-Disposition` now appears in the response alongside the actual `Content-Disposition` header.

### Results

| Check | Result |
|---|---|
| Downloaded file contains real model data | Pass (confirmed even before the fix — the bug was cosmetic/filename-only, not data corruption) |
| `Access-Control-Expose-Headers: Content-Disposition` present in response | Pass (confirmed via `curl -i` with `Origin` header, post-fix) |
| Actual browser re-test after the fix | Not yet re-tested — recommend re-download a model to confirm the filename now shows correctly |

### Notes
This is a good example of a bug class that's invisible without an actual browser: everything about the request/response was correct at the HTTP level, and every automated check available in this round's sandboxed environment (no browser access) would have called this "done." It only surfaced because actually clicked the button. Worth keeping in mind for any future feature that relies on a custom response header being readable by frontend JS — it needs `exposedHeaders` even if `curl` says everything's fine.

---

## Task 8.8 — Real Student Attribution on Quiz Attempts
Date: 20 Jul 2026
Tester: 

### Test Method
Real Postgres + backend, tested via `curl` with real teacher and student JWTs (two separate student accounts, to confirm no cross-contamination), plus static verification (`tsc`, `eslint`, `npm run build`) for the frontend piece.

### Test Environment
- Local Postgres 16 + Node backend, outside Docker (same sandboxed setup as all other backend tests this round)
- `curl` for API calls
- `tsc --noEmit`, `eslint`, `npm run build` for frontend verification

### Results

| Case | Expected | Result |
|---|---|---|
| Migration applies cleanly | `ALTER TABLE` | Pass |
| Student submits a quiz | Attempt recorded with real `student_id` matching the logged-in user | Pass — confirmed via direct DB query |
| `GET /api/students/me/attempts` (that student) | Returns the attempt with the correct quiz title joined in | Pass |
| `GET /api/students/me/attempts` (a different student) | Empty array — no cross-contamination | Pass |
| `GET /api/students/me/attempts` with no token | 401 | Pass |
| Regression: `GET /api/attempts/:id` (old sessionStorage workaround) | Still works unchanged | Pass |
| Regression: `GET /api/quizzes/:id/attempts/pending` (teacher grading) | Still works unchanged | Pass |
| `tsc --noEmit` | 0 errors | Pass |
| `eslint` on changed files | 0 new errors (8 pre-existing `any`-type errors elsewhere in `Quizzes.tsx`, confirmed not introduced by this change — see notes) | Pass |
| `npm run build` | Clean | Pass |

### Notes
- The 8 pre-existing ESLint `no-explicit-any` errors in `Quizzes.tsx` (on `pendingAttempts`, `attemptAnswers`, `openEndedResults` state, from the earlier teacher-grading feature) were confirmed present before this round's changes too — not fixed, out of scope for Task 8.8, same judgment call as leaving `AppContext.tsx`'s pre-existing lint warning alone in an earlier session.
- Not yet confirmed in the real Docker environment or an actual browser — same "next step" pattern as everything else this round.
- The frontend adds a new "My Quiz History" section below the main quiz list (student view only), showing all attempts newest-first with quiz title, date, and either a score or a "Pending Review" badge — refreshes automatically right after a new submission, no page reload needed.

---

## Known Issues Found — 20 Jul 2026 (logged; both resolved later, see notes below)
Date: 20 Jul 2026
Tester: 

### Issue 1: Teachers can submit and grade their own quiz
`POST /api/quizzes/:id/submit` requires `authenticate` only — no check that the caller is a student. Found this by logging in as a teacher, using the dev-mode role toggle to display the Student view of a quiz she created, and successfully submitting an attempt. Confirmed at the code level: the route has no `requireStudent`-style guard (only `requireTeacher` exists as a role-check middleware; there's no equivalent for restricting *to* students). Per `PRD.md`'s role table (FR-15/section 6), only students should be able to take quizzes — teachers are explicitly excluded. This is a real RBAC gap, not just a dev-toggle quirk: even without the dev toggle, nothing stops a teacher's real JWT from calling this endpoint directly.

**Resolved (later work, 2026):** starting and submitting a quiz now require the student role, so a teacher's token is refused. Original note: **Not yet fixed.** Options to consider: add a `requireStudent` middleware (mirroring `requireTeacher`) and apply it to `POST /api/quizzes/:id/submit`, or decide this is acceptable (e.g. if teachers previewing/testing their own quiz is considered a feature, not a bug) — worth a deliberate decision either way rather than defaulting to "fix it," since PRD doesn't explain *why* teachers are excluded.

### Issue 2: Quizzes auto-publish immediately on creation
 noticed a newly created quiz already shows "Unpublish" (i.e. is published) right after finishing creation, with no separate manual publish step. **This is not a new bug** — it's documented, intentional behavior from 15 Jul 2026 (see Task 8.3's note in `tasks.md`): quizzes are created unpublished, but auto-publish once the teacher clicks "Done" after adding questions. Flagging here because Found it surprising when encountering it fresh — worth a deliberate decision on whether this is the desired UX (matches how a teacher might expect to "finish creating" to mean "ready for students") or whether quiz creation should leave quizzes unpublished by default, matching how model/video upload work (both start unpublished, requiring an explicit separate publish action).

**Resolved (later work, 2026):** new quizzes are now created unpublished and stay hidden from students until the teacher publishes them. Original note: **Not yet changed** — no action taken tonight, pending the decision on which behavior is actually wanted.

---

## Task 7.6 — Video-to-Annotation Linking UI (Teacher)
Date: 20 Jul 2026
Tester: 

### Context
This was previously blocked on an architecture decision (add a video link field, or drop it as out of scope), and had been treated as not the task since it touches `Viewer.tsx`. Decided to resolve the decision herself and build her half — the video-linking UI lives in `Videos.tsx`, not `Viewer.tsx`, so this was buildable without touching Tim's file. Task 7.5 (showing the linked video inside the 3D Viewer) remains open for Tim.

### Test Method
Real Postgres + backend, tested via `curl` with real teacher and student JWTs, plus static verification (`tsc`, `eslint`, `npm run build`) for the frontend.

### Test Environment
- Local Postgres 16 + Node backend, outside Docker (same sandboxed setup as every other backend test this round)
- `curl` for API calls
- `tsc --noEmit`, `eslint`, `npm run build` for frontend verification

### Results

| Case | Expected | Result |
|---|---|---|
| Migration applies cleanly | `ALTER TABLE` | Pass |
| `GET /api/annotations` (teacher) | Lists all annotations across all models, with model title joined | Pass |
| `GET /api/annotations` (student) | 403 (teacher-only) | Pass |
| Link a video to an annotation via `PUT /api/videos/:id` | 200, `annotation_id` set correctly | Pass |
| Re-fetch the video | `annotation_id` persisted | Pass |
| Un-link (omit `annotation_id` on a subsequent edit) | `annotation_id` correctly reset to `null` | Pass |
| Regression: old-style edit call with no `annotation_id` field at all | Still works, defaults to `null`, no error | Pass |
| Regression: `GET /api/videos` list still returns correctly | Pass | Pass |
| `tsc --noEmit` | 0 errors | Pass |
| `eslint` on changed files | 0 errors (after fixing one pre-existing issue — see notes) | Pass |
| `npm run build` | Clean | Pass |

### Notes
- Design decision made during this task: the FK lives on `videos.annotation_id` (pointing at the annotation), not on `annotations.video_id` (pointing at the video). This matches the original `tasks.md` spec's intent more closely (it proposed `videos.linked_label_id`) and keeps the entire feature buildable within `Videos.tsx` and the video routes in `server.js`, without touching anything in the annotations routes or `Viewer.tsx`.
- Found and fixed a pre-existing lint error in `Videos.tsx` while working in the file, unrelated to this task's new code: `loadVideos` was referenced inside a `useEffect` before its own declaration further down the file — same exact pattern as the one fixed in `ModelGallery.tsx` earlier this round. Fixed the same way, by moving the function declaration above the effect that uses it.
- Not yet tested in the real Docker environment or a real browser — same "next step" pattern as everything else built this round.
- The "linked annotation shown in the video management table/grid" part of Task 7.6's checklist was not built — the dropdown and save work, but there's no visual indicator on the video card/row showing which annotation (if any) it's linked to. Minor, could be added later.
## optimizingViewer further refactor — 21 Oct 2026
Implemented typed annotation/domain boundaries, shared serialization/draft updates, one exclusive tool mode, guarded model/video fetching, consolidated create/edit handling, duplicate-save protection, and model/thumbnail lifecycle cleanup. Scene-mutating annotation helpers returned to Viewer.tsx; UI panels no longer receive OrbitControls, and role controls read AppContext. Removed unused isolation state and dead camera clamp helper. Shared LinkedVideo definition replaced the duplicate panel definition.

Verification:
- npm run test:viewer: 10/10 pass. Covers API JSON round trips for point/legacy draw/legacy region/projected highlight/projected region, cached geometry/view/opacity retention, nullable legacy data, draft editing semantics, default colors, all tool transitions, and projection frame calculations without input mutation.
- npm run build: passes; existing bundle-size warning remains.
- Focused ESLint on touched TS/TSX/test files: zero errors; two inherited Viewer effect dependency warnings remain. Full unrelated application lint was not used as a completion gate.
- Browser teacher account: real GLB loads; exclusive highlight/region switching and cancel; select/edit saved annotation; create/save/delete a point; sequential numbering; linked video modal; neutral-view save; create/save projected highlight; draggable panel moves. Database re-fetch confirms edited text, deletion, generated projected geometry cache and opacity.
- Browser student account: same model/annotation/linked-video controls without teacher edit/draw actions. All four program selectors exercised. Invalid model identifier displays an error. Canvas count is one in Viewer and zero after navigation to gallery, including immediate exit from a second model load. No browser warnings/errors captured.
- Evidence: verification/viewer-refactor.png. Temporary QA accounts, records, and generated QA thumbnails removed; existing content retained.
Limits: no GPU-memory benchmark, comprehensive mobile/tablet or cross-browser sweep, injected network-failure/double-click test, or full region-fill gesture test. Lifecycle safety is supported by guards/disposal review and canvas/navigation checks, not a measured zero-leak guarantee.

## Shorter Viewer.tsx — 21 Oct 2026
Reduced the prior working Viewer from 1,413 to 1,167 lines. Extracted useAnnotationEditor (form/persistence workflow), ViewerOverlay (presentational composition/list/video UI state), and createAnnotationBadge (canvas painting only). Reused hit-target cleanup for annotation deletion; removed the unused model-radius ref. Scene mutations, textures/materials/geometry, and raycasting remain in Viewer.
- npm run test:viewer: all 10 pass; npm run build: passes, existing bundle warning remains.
- Focused lint: zero errors; two existing effect-dependency warning sites remain. The scene effect's warning now includes editor; adding the changing controller object as a dependency would recreate the scene on form input, so no suppression or broad dependency change was made.
- Browser teacher test: actual GLB load; collapse/expand list; edit and save seeded annotation; edit again then cancel; draw/save a new projected highlight; reopen seeded annotation's linked video; close dialogs. Database check confirms edited label preserved, canceled text absent, second annotation inserted with projected cached geometry. Student account has view-only controls. Returning to gallery leaves zero canvas elements. No captured browser warnings/errors. Screenshot: verification/viewer-shorter.png.
- Isolated QA users/content and generated thumbnail removed afterward. Existing content retained. No API, schema or uploaded-file format change.
Limits: full region-fill gesture, injected API-failure/double-submission, repeat mobile/tablet/cross-browser sweeps and GPU memory profiling were not repeated for this extraction. Existing baseline tests and the prior Viewer regression log remain applicable.

## Viewer further reduction to 972 lines — 21 Oct 2026
Before this step: 1,167 lines; after: 972 lines. Extracted loadViewerAnnotations with injected typed repository and plain-record rendering callbacks. Reused data/editor hooks for neutral-view and delete persistence. Centralized selected/hovered identity matching and camera application. Replaced three tool-state mirror refs/effects with one mode ref.
- Expanded focused Node suite: 16/16 pass, including existing serialization/projection/mode tests plus loading/cache/selection cases. Specifically tests no rendering after a late response or navigation during cache persistence, continuing after a cache-save error, cache reuse, and reporting load failures without changing the view.
- Build passes (existing bundle-size warning); focused lint has zero errors/two previously tracked effect-dependency warnings. Whitespace diff check passes.
- Browser: teacher model and annotation loading; select/delete loaded point; create replacement point with single mode ref; save neutral view; reload preserves point and neutral view. Actual student sees loaded point without teacher edit actions. Returning to gallery leaves zero canvas elements; no captured browser errors/warnings. Database re-fetch verifies original point deleted, one replacement and neutral view persisted.
- QA users/model/annotations/generated thumbnail removed; existing user content retained. Evidence: verification/viewer-under-1000.png.
Scope limits: projected-region gestures, all-program/mobile/cross-browser sweeps and GPU profiling were not repeated; prior regression records remain separate evidence. No API/database contract changes, and no measured rendering-performance claim.

## Viewer reduced from 972 to 859 lines — 21 Oct 2026
Extracted plain drawing sample storage/preview state and DOM event subscriptions. Centralized projected draft defaults, painted-hit acceptance, non-projected visual setup and shared-geometry-aware mesh cleanup. Added cleanup cancellation/guard for the existing deferred region-generation timer. Scene resources remain local to Viewer.
- Build passes; all 21 focused tests pass. New tests cover pointer offsets/zero-sized canvas, jitter rejection, aligned sample arrays, copying inputs/snapshots, reset between drawings, every event listener removed including both pointermove handlers and resize, idempotent unsubscribe, and projected fill/stroke defaults.
- Focused ESLint: zero errors/two inherited Viewer effect-dependency warning sites. Scene warning now lists drawing and callback dependencies; no warning suppression or changing controller-object dependency was added. Diff whitespace check passes.
- Actual teacher browser: GLB load; seeded legacy draw/filled-region selection; drag and save projected highlight through extracted sampler; generated geometry cache and 0.32 opacity verified in database; delete highlight; reload preserves both legacy annotations and allows selection. Student account sees legacy annotations without edit/draw controls. Returning to gallery leaves zero canvas elements. No captured browser errors/warnings. Evidence: verification/viewer-859.png.
- QA users/model/annotations/generated thumbnail removed afterward; existing content preserved.
Limits: no full region-fill gesture, GPU profiling, new cross-browser/mobile/program sweep, or direct masked hover/click coordinate automation in this pass. Sampling/event tests and actual highlight drawing support this refactor; no measured speedup or exhaustive leak guarantee is claimed. API/schema/storage formats unchanged.

### Viewer basic-renderer consolidation � 21 Oct 2026
Reduced Viewer.tsx from 859 to 810 lines. Production TypeScript/Vite build passes; 22 viewer tests pass. Added coverage preserving point position/size, legacy drawing samples, triangle coordinates, colors, transparency and missing-data handling. Focused ESLint: zero errors, two inherited effect-dependency warnings. Existing large-bundle warning remains. Docker images rebuilt and login page renders in the browser. Browser scope for this pass is startup only; teacher/student annotation interaction, responsive layouts and four-program checks were not rerun. Previous interaction verification remains recorded above. No API, schema or storage changes.

### Final Viewer consolidation - 21 Oct 2026
Reduced Viewer.tsx from 810 to 760 physical lines by consolidating scene registration, hotspot/hit-target construction, point conversion and camera synchronization. Production build and all 22 Viewer tests pass. Focused ESLint reports zero errors and the same two effect-dependency warnings; the existing large-bundle warning remains. Docker images rebuilt and all three services started. Browser verification used a temporary teacher and point annotation to confirm model loading, numbered annotation rendering, list selection, camera focus and details rendering with no console warnings/errors. Both temporary records were deleted afterward. Responsive and four-program checks were not repeated. No API, schema or storage changes.

## Architecture and design documentation audit - 21 October 2026

Rewrote repository-root Architecture.md against the current frontend, viewer modules, API client, Express server, SQL scripts, manifests and Docker configuration. Replaced the earlier design specification with the implemented light/dark palette, typography, page layouts, role controls, viewer panels, dialogs and breakpoint behavior. Added current-reference guidance to README.md. No application, API, schema or asset behavior changed.

Verification for this pass:
- Cross-checked route paths/provider order, session/theme persistence, role/program behavior, API authorization, storage formats/limits, annotation mappings/cache/disposal and quiz grading against source.
- Cross-checked UI classes, page grids, theme variants and modal/panel structure against source; documented limitations rather than claiming browser-verified responsive/accessibility coverage.
- Attempted npm run build: could not run TypeScript because tsc is not installed in this checkout.
- Attempted npm run test:viewer: stopped at module loading because package three is not installed. The 22 source-defined cases were not executed successfully in this pass; prior passing records above are historical.
- No browser, API, database or GPU checks performed for this documentation-only change.
- tasks.md was already deleted in the incoming working tree; preserved that deletion instead of restoring or replacing the user's task file.

## Main-agent instruction and requirement reorganisation - 21 October 2026

Replaced the multi-role Agents.md with a main-agent role, reference map, workflow, documentation responsibilities and task-status rules. Moved product/role, prototype-content, visual and QA acceptance obligations into PRD.md section 13. Preserved the former Agents.md engineering sections (architecture layers, implementation rules, development order, naming, expected types and viewer checklist) in coding_guidelines.md section 17, with additional boundary guidance and no relaxation of existing requirements. Updated README.md with document ownership.

Verification: compared the original Agents.md sections against their new destinations, checked local Markdown links in the revised agent instructions, and ran git diff --check. No runtime code changed; build, browser, API and regression tests were not rerun for this documentation reorganisation. Existing implementation/requirement differences remain. The incoming tasks.md deletion was preserved.

## Access, programme, assessment and usability implementation — 22 October 2026

Implemented the seven requested work areas: authenticated teaching files; publication/programme/attempt ownership and thumbnail permissions; teacher-controlled downloads; programme assignment/filtering; transactional assessment submission/grading and complete teacher results; label movement/question bank/timers/photo materials; model-format and keyboard/mobile/error-feedback improvements. Updated root Architecture.md/design.md plus README/API/schema/storage/model-format documentation. Migration 008 was applied additively to the local PostgreSQL database; existing models begin with downloads disabled and existing quizzes remain untimed. Incoming task-file deletion and unrelated documentation work were retained.

### Automated verification

- Production TypeScript/Vite build passes in the existing Node 22 frontend container. The existing large-bundle warning remains (about 1.12 MB minified after adding USDLoader).
- ESLint: zero errors, two existing Viewer effect-dependency warning sites. Provider/context/hook definitions were separated instead of suppressing refresh rules; development hot-reload context identity errors observed while editing were resolved. Final clean-load browser checks captured no warnings/errors.
- `npm run test:viewer`: 22/22 pass.
- `npm run test:models`: 2/2 pass, real OBJ triangle and embedded USDA-in-USDZ archive parsing.
- Backend `node --test tests/access.test.js tests/integration.test.js`: 17/17 pass (four policy/validation cases plus the integration parent and twelve workflow subtests). Tests exercise all four programme IDs at policy level, cookie/bearer asset access and byte ranges, publication enforcement, forbidden thumbnail writes, explicit download flags, programme reassignment, timer sessions/hidden keys, duplicate/malformed submissions, owned results, grading/final scores, expiry, question-bank copies/category/edit/delete, active-session question locks/cancellation, favourite-deletion triggers and photo delivery/logout.
- Injected an answer-insert foreign-key failure: response 500, attempt/answer writes rolled back and session remained unconsumed. The expected database-error log is part of that test. A guarded question edit returns the expected 409, also logged by error middleware.
- Actual frontend proxy checks from its localhost origin: unauthenticated video/model URLs returned 401; authenticated cookie requests returned 200. `/public/videos/s.mp4`, `/@fs/app/public/videos/s.mp4`, backend source and compose-file aliases returned 403. Earlier requests using the Docker service hostname were rejected by Vite's Host allowlist and were not counted as authorization evidence.
- Local host npm install failed; verification used the already-installed container dependencies rather than claiming a successful host installation.

### Browser verification

Used isolated temporary teacher/student accounts, a triangle OBJ, point annotation/linked existing sample video and a timed MCQ quiz. Verified mobile navigation expansion, authenticated OBJ rendering, annotation selection and Move placement, linked native video controls, programme selection filtering, teacher download permission persistence/enabled action, student timer/countdown, 100% score, persisted history and owned answer review after a clean reload. Verified Escape closes a result dialog and restores the invoking control's focus. Teacher View Results displayed the graded student's score; Edit Questions saved the temporary question to the bank with its category; saved timer/programme settings were visible. Narrow-viewer overlap found during QA was corrected by moving instructions down and reserving toolbar/list space.

Evidence: [access-assessment.png](verification/access-assessment.png). Model position update and assessment results persisted through API/database-backed workflows. Logged out of both test accounts and removed recorded QA users/model/video/quiz/annotations/bank copies/generated OBJ/thumbnail afterward; pre-existing content retained. Integration tests independently remove their temporary records/files.

### Scope limits

Browser checks used the in-app Chromium browser at its narrow viewport. A full desktop/tablet/four-programme browser sweep, Chrome/Edge/Firefox/Safari matrix, GPU leak profiling, concurrent teaching-session load tests and complex/binary USDZ exporter coverage were not performed. USDLoader's USDA parser requires compatible formatting in the tested fixture; UASSET still requires export to GLB and multi-file glTF needs embedding/conversion. Basic upload signatures are not antivirus scanning. Download flags govern the attachment feature and cannot stop an authorised viewer extracting model bytes delivered for rendering. Cloud storage adapters, embedded model annotation exports, backup automation, old orphan-file cleanup and complete accessibility certification remain separate PRD/operational work. No claim of full PRD compliance is made.


## 22 October 2026 — follow-up regression, session lifecycle and recovery

Confirmed product choices: teachers may self-register; students see published assigned-programme and shared content. Applied additive migration 009 to the local PostgreSQL volume. No volume reset or live-data restore was performed.

| Check actually run | Result |
|---|---|
| Frontend TypeScript + Vite production build | Passed; initial JS 366.38 kB / gzip 97.32 kB, lazy Viewer 749.95 kB / gzip 195.44 kB. Viewer chunk still exceeds warning threshold. |
| Frontend ESLint | 0 errors; 2 existing Viewer effect-dependency warnings. |
| Viewer regression suite | 22 passed. |
| OBJ/USDZ parser suite | 2 passed; no claim of broad binary-USDC support. |
| Backend policy suite | 4 passed. |
| Backend real-DB integration | 14 scenarios passed (15 TAP tests including parent). Covers four actual student and teacher programme accounts, assigned/shared list/direct reads, revoked bearer/cookie denial, independent teacher session, abandoned untimed expiry, active-session preservation and question-edit lock during transport grace, alongside prior transactional/access checks. |
| Responsive Chromium smoke | 30 page/role/width combinations: Dashboard, Models, Videos, Quizzes, Library; student + teacher; 375/768/1440px iframe viewport. No horizontal document overflow after fix; no rendered img missing alt. These are layout smoke checks, not complete workflow/accessibility certification. |
| Tablet navigation | Found 992px document width in a 768px quiz viewport. After moving desktop navigation to xl, document fits (753px with scrollbar). Mobile menu opens and navigates. Search controls and logo now have accessible names. |
| Student timed quiz browser workflow | Disposable PT student started 60s quiz, selected answer, submitted, received 100% and a history entry. Saved verification/responsive-quiz.png. |
| Backup + isolated restore | ops/Backup.ps1 -VerifyRestore succeeded: snapshot-20261022-022729; pg_restore into restore_snapshot_20261022_022729; every asset hash and selected table row count matched. Backend restarted. Restored data remains isolated for inspection. |
| Backup exposure protection | Frontend-origin requests to /backups/.../database.dump and /@fs/app/backups/.../database.dump both returned 403. Backups are ignored by Git and Docker context. |

The first expanded programme-matrix test run exposed duplicate synthetic email generation in the test helper; unique fixture suffixes fixed it and the full integration suite passed on rerun. Expected injected SQL-FK failures and protected-edit 409 messages still appear in test output and are asserted regression cases. Temporary browser users, models, videos, quiz/attempts and generated files were removed using the fixture cleanup script before the backup.

Only in-app Chromium was connected. Chrome/Edge/Firefox/Safari, real mobile hardware, every programme through every browser workflow, textured-model annotation stress, GPU/concurrent load and complete assistive-technology checks remain unverified. The harness browser log captured one MutationObserver parameter error without an app source location during frame navigation; no source usage was found, so its origin is unresolved and this run does not claim a clean console certification. Backup scheduling/off-site replication, orphan cleanup, embedded annotation exports and a complete cloud storage adapter remain separate work.


## 22 October 2026 — viewer reliability pass

Implemented model-ID/file-path scene lifetime, current callbacks via Effect Events, stale-mutation guards/editor reset, numbered-hotspot picking, pointer capture/cancellation, orbit-drag click suppression, nearly collinear region rejection, responsive camera framing/clipping, damping-safe explicit poses, resource/context disposal, loading feedback and inline annotation errors. API routes, database schema and supported file formats did not change.

| Verification actually run | Result |
|---|---|
| Frontend ESLint | Passed: 0 errors, 0 warnings. Both former Viewer dependency warnings resolved without suppressions. |
| Viewer unit/regression suite | 26 passed, including portrait/extreme-aspect framing, scale-dependent clipping, immutable move payloads preserving IDs while invalidating cache, thin/collinear region rejection, cancellation/unsubscription and click-vs-drag behavior. |
| Format parser suite | 2 passed (OBJ and USDA in USDZ). |
| TypeScript + Vite build | Passed; initial JS 366.43 kB, lazy Viewer 754.14 kB. Viewer chunk warning remains. |
| Existing anatomy GLB | A1's 3.74 MB textured model loaded in connected Chromium. Rotate/zoom/reset verified visually. Found and fixed damping causing motion after reset; reset now restores the initial view immediately. No original model/annotation edits were made. |
| Teacher textured glTF | Two transformed meshes with embedded checker texture rendered. Clicking a numbered canvas hotspot opened its annotation. Linked video reached readyState 4, advanced playback and had no media error; Escape closed the dialog and restored focus. |
| Annotation creation/move | Drew and saved a projected highlight. Empty label produced an inline error. Moved point and highlight to the second mesh, retained point ID 15 and video link, and reloaded. Stored polygon rendered; edited opacity to 100%, moved region to mesh 1 and reloaded. Teacher-generated projected caches persisted with 99/72 position values. |
| Region invalid input | Near-straight drag produced 'Draw a region with an enclosed area' instead of a save form. Full polygon authoring was not automated. |
| Metadata update | Saving the fixture's neutral view preserved the active scene/annotation selection and showed a toast. |
| Repeated SPA navigation | Five gallery -> textured viewer -> gallery cycles: canvas count 1 inside, 0 outside. No new warning/error during these cycles after correcting fixture PNG. |
| Student workflow | Authoring controls absent; all three saved labels rendered; linked video played (readyState 4, no error) and Escape restored focus. |
| Responsive viewer | 375/768/1440px iframe widths had matching document width and canvas CSS widths; draw buffers tracked device pixel ratio (468/960/1800px). No document overflow. |
| Final fresh-load console | No new errors/warnings during final student load/playback/resizing checks. |

During development, the initial one-pixel fixture PNG failed decoding; it was replaced with a valid generated checker texture. Adding a hook to useViewerContent during live HMR caused a hook-order error; a full reload resolved the development refresh state, and the final fresh-load checks were clean. Colour-input automation changed the native control value without updating React's draft, so this pass does not claim a successful browser colour-change verification. Opacity persistence was verified.

Saved proof: verification/viewer-textured-region.png. Fixture setup refuses to overwrite an existing manifest and cleanup removed the temporary users, two models, annotations, linked video, generated model files and thumbnails. Existing teaching records were preserved.

Limits: only connected in-app Chromium; no Firefox/Safari/standalone Edge/Chrome certification, real-touch hardware, complete freehand polygon authoring, delayed-network CRUD stress, skinned/animated browser fixture or GPU-memory/concurrency benchmark. Resource disposal paths were reviewed, not measured with a GPU profiler. Cross-mesh drawing still uses a dominant source mesh, and the existing projected-surface fallback behavior remains unchanged. Broader accessibility, content organisation, portable exports and production deployment work remain separate follow-ups.


## 22 October 2026 — accessibility and error/retry pass

Started/confirmed the development stack with Docker Compose. Implemented page-local resource lifecycle and persistent status/retry UI, accessible field associations, background-inert/scroll-locked dialogs, navigation focus semantics, reduced motion and unified JSON/download error handling. Backend routes, schema and storage are unchanged.

| Verification actually run | Result |
|---|---|
| Frontend production build | Passed: initial JS 373.98 kB, lazy viewer 754.14 kB; viewer chunk warning remains. |
| ESLint | Passed with 0 errors/warnings. |
| Client API regression | Passed: connection failure, malformed successful JSON, non-JSON gateway error, safe 5xx fallback, preserved 4xx validation, auth-401 isolation and protected JSON/download expiry. |
| Viewer / format suites | 26 viewer + 2 OBJ/USDZ parser cases passed. |
| Backend policy/integration | 4 policy tests + 14 real-DB scenarios passed (15 TAP tests including parent). Expected injected SQL/409 output is asserted by the existing suite. |
| Teacher form names | Upload Model, Upload Video, Upload Content, Create Quiz and Edit Questions were inspected in the connected Chromium browser. Visible dialog inputs/selects/textareas had associated labels or explicit accessible names. Model system/part filters were also named. |
| Dialog keyboard/isolation | Upload Model initially focused its close control; Shift+Tab wrapped to Upload, Tab wrapped back, Escape closed it and restored the upload trigger. Body overflow was hidden while open, 7 background branches inert, then overflow restored and inert count returned to 0. Nested stack cleanup is implemented but was not browser stress-tested. |
| Skip navigation | Tab + Enter on Skip to content focused main-content. Subsequent SPA navigation focused the main region. |
| Controlled outage | Stopped backend only. Videos showed separate persistent video/annotation-link failures; Dashboard showed an error and unavailable stats; Library showed a resource error with Try again. These views did not claim empty content. Restarted backend, clicked Library Try again and restored the resource list without reloading the page. |
| Unavailable video | A valid numeric route for an absent video showed a heading, back navigation and retry. Repeated failed retry retained keyboard focus on Try again. The nonnumeric /videos/... path remains handled as a file route by the development proxy. |
| Student keyboard quiz | Selected Femur using Space, used Tab/Tab/Enter to submit and received 100%. The named radio group/answers, history entry, modal cleanup and focus return were observed; no authoring controls appeared. |
| Mobile navigation | Native browser viewport override 375x812: menu opened, Escape from a link closed it and restored Toggle navigation focus; document width remained 375px. Override was reset afterward. |

Proof: verification/content-retry.png captures the deliberate materials outage and retry control. Backend was restarted and services were left running. Browser fixture accounts, model/video/quiz, generated attempt and file were cleaned using the existing disposable fixture script after verification.

Deliberate outages/missing-content probes produced expected HTTP errors in browser logs; healthy navigation afterward produced no new error/warning in the inspected interval. This was in-app Chromium only. No complete NVDA/VoiceOver, contrast, captions/transcripts, reduced-motion visual audit, real touch hardware, four-programme browser matrix or WCAG certification is claimed. Resource stale-response guards were reviewed; slow-network race injection and nested-dialog stress remain unverified. Content taxonomy, portable exports, deployment/off-site backup scheduling and broad release performance testing remain separate work.


## Screen-reader/compatibility follow-up — 22 October 2026

Reason the previous items remained open: prior runs used the connected in-app Chromium browser, with no screen reader or independent browser-engine execution. This follow-up checked available surfaces rather than treating missing coverage as a passing result. Installed Chrome/Edge executable paths exist; neither appears in the connected browser inventory. Firefox/NVDA were absent at the standard paths checked. Only IAB and MCP Apps are exposed; native app automation is disabled. No screen-reader or four-browser pass is claimed.

Implemented page-specific titles and a stable polite/atomic route status; named main landmarks on auth pages; associated registration password instructions; expanded/pressed annotation states and a named selected-details region.

Executed checks:
- Docker frontend lint: passed, no warnings/errors.
- Docker frontend production build: passed; initial JS 374.65 kB, viewer 754.23 kB; existing chunk-size warning remains.
- Chromium login/register navigation: page titles and named main landmarks visible in accessibility tree; route status changes with destination.
- Disposable authenticated student dashboard and model viewer: corresponding title/status exposed.
- Model fixture 40: Space selects QA point, pressed state changes false to true; named “Annotation details: QA point” region exposes description and linked video. Enter collapses the annotation list, aria-expanded becomes false and annotation button disappears. Evidence: verification/annotation-accessibility.png.
- Manual spoken-output testing, Firefox, Safari and standalone Chrome/Edge execution: not run; environment prerequisites and release procedure in accessibility_compatibility.md.

Fixture setup used backend/tests/browser-fixture.js with temporary accounts/model/quiz/video; cleanup recorded below. No content policy, schema or backend route changed.

Cleanup completed successfully: temporary users 68/69, model 40, quiz 26, video 10 and generated fixture files removed. Docker services remain running.


## Playwright/axe alternative completed — 22 October 2026

The user explicitly selected terminal Playwright testing because no screen reader was available. Added @playwright/test 1.64.1 and @axe-core/playwright 4.14.0, four browser projects, owned disposable fixtures, HTML/JSON reports and a sanitized summary generator. Chrome/Edge used installed channels; Firefox/WebKit were downloaded into the ignored project directory.

Final consolidated execution started at 08:20:51 UTC / 16:20:51 Singapore and completed in 200 seconds: **35 passed, 1 skipped, 0 failed**. Chrome 155.0.8059.85, Edge 155.0.4283.62 and Firefox 157.0 each passed all nine workflows. Windows WebKit 27.2 passed eight workflows; its separate MP4 playback check was explicitly skipped. All 116 axe scans returned zero violations for the configured WCAG 2 A/AA and 2.1 A/AA rules. See verification/browser-accessibility-summary.json for check names, limitations and incomplete/manual-review rule IDs.

Verified real UI/authentication for both roles, light/dark five-section navigation, titles/current-page/main focus, upload dialog Tab/Shift+Tab/Escape/inert background, compact navigation/skip link, rendered OBJ/keyboard annotation details, linked-video modal, native MP4 playback on three browsers, keyboard MCQ submission with 100% result, and intercepted 503 read failure/retry recovery. Media HTTP range delivery returned 206. The final suite uses 1440×900 desktop and 375×812 compact navigation; it is not a complete programme-by-browser-by-viewport matrix.

Findings fixed:
- Low-contrast slate-400/dark-slate-500 secondary text and linked-video close text; updated to contrasting theme colours.
- WebKit skipped the href-only skip link during Tab navigation. Explicit tabindex=0 makes it reachable; the final WebKit keyboard check passed.
- The test now waits for the rendered dashboard, uses Enter to invoke a dialog/submit quiz, and checks inert DOM state directly. WebKit pointer-click focus behavior is not treated as proof of keyboard return focus.
- Browser downloads/report directories were being polled by the Docker/Windows Vite watcher, causing severe QA-induced delays. Explicit ignored paths restored normal test runtimes; local reports/manifests/binaries are also excluded from lint/Docker/Git and denied by Vite file serving. One earlier Chrome viewer readiness timeout disappeared in subsequent runs. Viewer readiness has a bounded 45-second assertion, not a performance certification.

Known platform/manual limits:
- Windows Playwright WebKit returned NotSupportedError for the existing H.264 Main, yuv420p/AAC LC MP4 despite working authenticated delivery. The app showed its media error; actual Safari/macOS playback remains required. No Safari success is inferred.
- Axe incomplete findings include complex-background contrast, annotation icon label matching, video captions and WebKit autoplay audio. The minus-icon name matches collapse intent; full manual contrast/caption/audio review and NVDA/VoiceOver speech were not performed.
- Build and lint passed after the fixes (lint 0 errors/warnings). Initial JS 374.66 kB, viewer 754.28 kB; existing viewer chunk-size warning remains. Scoped diff whitespace check passed.
- npm audit reported 16 existing dependency advisories (4 moderate, 12 high); the new Playwright/axe packages were not listed. The production-only audit reported 2 of these in react-router/react-router-dom (1 high, 1 moderate). A general dependency upgrade was outside this compatibility change; these remain a separate remediation item.

All final disposable users/models/quizzes/videos/attempts and generated assets were cleaned by global teardown; the local fixture manifest is absent. All three Docker services remain running. No production schema, product policy or backend API route changed. Screenshot proof: verification/playwright-dashboard-dark.png.


## Follow-up: autoplay and repeat verification — 22 October 2026

Standalone `/videos/:videoId` no longer starts playback on page load; the learner starts playback with the native controls. The linked-video dialog keeps autoplay after the explicit Watch action. Added a Playwright assertion that standalone playback has no `autoplay` attribute.

Checks run in this workspace:
- `npm run lint`: pass, no errors or warnings.
- `npm run build`: pass; existing Vite viewer-chunk size warning (754.28 kB) remains.
- `npm run test:viewer`: 26/26 pass.
- `npm run test:api`: 1/1 pass.
- `npm run test:models`: 2/2 pass.
- `git diff --check`: no whitespace errors; one pre-existing extra blank line warning in root `coding_guidelines.md`.

Re-running `npm run test:browser` was blocked before fixture creation: the host sandbox denied localhost socket access to ports 5173/5000. Docker services had reported healthy, but subsequent Docker API access was denied through the Docker Desktop named pipe, so no host-side rerun or container-side retry was possible. The previously recorded 35 passed / 1 skipped browser matrix is historical and predates the autoplay assertion; it is not represented as a fresh run here. `npm audit` likewise could not reach `registry.npmjs.org` (`ENOTFOUND`), so dependencies were not changed without current advisory data. Earlier audit findings (16 total, 2 production React Router advisories) remain unresolved until the registry is reachable.

Actual Safari/macOS video, NVDA/VoiceOver spoken output, exhaustive rendered-state contrast checks, and caption accuracy review remain open. The user selected Playwright/axe as the available screen-reader alternative; it does not establish spoken output.


## Captions, dependency remediation and browser rerun — 22 October 2026

This supersedes the earlier blocked rerun and dependency counts above. Optional English WebVTT caption delivery was implemented: teachers can provide/replace/remove a VTT file with a video, the backend validates its header and size and stores it under an opaque protected path, and playback exposes a native English caption track. Existing authentication, publication and programme access rules protect the track. Database migration `010_video_captions.sql` was applied to the running local database without resetting its volume. Caption text is teacher-supplied; the application does not generate or certify it.

Dependency remediation completed with registry access. Frontend and backend `npm audit` each report **0 vulnerabilities**. The frontend moved to Tailwind CSS 4 with its Vite plugin; backend development now uses Node's watch mode instead of Nodemon, removing the vulnerable transitive dependency chain.

Final `npm run test:browser -- --retries=1`: **39 passed, 1 skipped, 0 failed** across Chrome, Edge, Firefox and Playwright WebKit. Chrome, Edge and Firefox each passed 10/10 tests; WebKit passed 9 and skipped the unsupported Windows H.264/AAC playback case. All 116 axe scans reported zero detected violations for configured WCAG 2 A/AA and 2.1 A/AA rules. WebKit exercised protected VTT retrieval through the authenticated browser request context because it did not automatically request the track for the fixture media. This verifies the track response and markup there, not native caption rendering in Safari. See `verification/browser-accessibility-summary.json`.

Other checks after the final code changes: frontend lint passed; production build passed with the existing large Viewer chunk warning; viewer tests 26/26, API tests 1/1, model tests 2/2, backend unit tests 5/5, and backend integration tests 16/16. `git diff --check` reports only the pre-existing extra blank line at EOF in root `coding_guidelines.md`; the added PRD trailing spaces were removed. Representative light/dark palette contrasts are documented in `accessibility_compatibility.md`; this is not a complete manual audit. Actual Safari/macOS video and caption rendering, screen-reader spoken output, and teacher-supplied caption accuracy remain unverified.

## Layered backend refactor — 22 October 2026

Refactored the Express backend into 13 feature modules with routes, controller bindings, application services and SQL repositories. server.js now handles process startup; app.js composes middleware/routes. Shared HTTP adaptation, role/content gates and upload configuration are separate. Authentication, all 64 endpoint methods/paths, response formats, file delivery and database schema are preserved. Existing assessment/question-bank imports remain compatibility shims. No migration or new runtime dependency is required.

Checks actually run in this pass:

- Final backend `npm test`: **8/8 passed**, including policy, HTTP adapter and layer-boundary checks.
- Final backend `npm run test:integration`: **19/19 passed** (18 scenarios plus the parent test). Covers existing programme/publication/session/grading/rollback/bank/caption policies plus registration, origin rejection, model upload/update/neutral view/download, parameterized model filtering, annotations and JSON/CSV exports, video/resource/quiz management and favourites. Deliberately induced database and question-lock failures log expected errors while their rollback/denial assertions pass.
- Frontend production build and lint passed. The existing Viewer chunk-size warning remains; no frontend source changed.
- All **66 backend source files** passed `node --check`. An AST comparison against the original route declarations confirmed **64/64 endpoint methods and paths** preserved.
- Full Playwright run: **39 passed, 1 skipped, 0 failed** across Chrome, Edge, Firefox and WebKit. Windows WebKit's unsupported H.264/AAC playback remains the expected skip. This ran after module extraction/shared validation cleanup and before the final repository filter/projection cleanup.
- After the final repository cleanup, a focused Chrome run passed **3/3**: student sections in both themes, teacher sections in both themes and keyboard quiz submission/results. The final backend checks above also ran after that cleanup. The full four-engine suite was not repeated after those last changes.
- Browser and integration fixtures were cleaned. Generated dashboard screenshots were restored so this backend refactor does not replace the existing visual reference. Final `git diff --check` passed.

The browser commands first ran the configured full suite because npm argument forwarding did not retain the requested filter in this PowerShell environment. The focused rerun invoked the Playwright CLI directly: `node node_modules/@playwright/test/cli.js test --project=chrome --grep 'main sections|quiz keyboard'`. Raw reports are ignored local artifacts; the existing shareable browser summary belongs to the previous documented run and was not regenerated for this refactor.

Limits: services use plain HTTP-shaped result records rather than a fully transport-independent domain model, and still coordinate local filesystem effects. No cloud-storage adapter was added. Actual Safari/macOS media/caption rendering and spoken screen-reader output were not verified. Product requirements and prior acceptance gaps remain unchanged.

## Docker backend recovery and host dependency fix — 23 October 2026

The backend container crash-looped with `Cannot find module 'helmet'`. Its anonymous `/app/node_modules` volume predated the dependency, and the `./backend` bind mount does not replace it. `docker compose up -d --build --renew-anon-volumes` recreated the anonymous volume while keeping `postgres_data`; the backend then applied migrations and listened on port 5000. The host `backend/node_modules` also lacked `helmet`, so `npm ci` was run in `backend/` from the lockfile (135 packages, 0 vulnerabilities).

Checks actually run in this pass: `docker compose ps` shows the postgres, backend and frontend containers running; `http://localhost:5000/api/health` returned 200 and `http://localhost:5173/` returned 200; backend `npm test` 8/8 passed; `require('./src/app.js')` loads on the host; frontend `npm run lint` and `npm run build` passed. Docker setup notes in `README.md` were updated with the renew-volume command and the host `npm ci` step.

Limits: the compose stack still uses development credentials and secrets. Browser flows and authenticated API behaviour were not re-tested in this pass.

## Administrator role for user management — 23 October 2026

Users page, `/api/users` routes and `/api/audit-log` are now administrator-only; teachers get 403 and are redirected away from `/admin/users`. Added migration `015_admin_role.sql` (applied automatically on backend restart), `scripts/create-admin.js`, admin-aware layout/breadcrumbs/profile, and admin guards (cannot demote/disable/delete self, last active administrator protected).

Checks actually run in this pass: backend `npm test` 8/8; backend `npm run test:integration` 31/31, including new assertions that teachers cannot list, create or unlock accounts or read the audit log, and that administrators can; frontend `tsc -b` and `npm run lint` clean. In the browser a temporary teacher had no Users link, no "Manage users" quick action and was redirected from `/admin/users`; a temporary administrator landed on Users, saw only the Users nav, and was redirected from `/3dviewer`. Both temporary accounts were deleted afterwards. The integration suites previously failed with 429 from the login limiter (10 per 15 minutes); they now set `DISABLE_RATE_LIMIT=true` in-process.

Limits: production build and the Playwright suite were not re-run.

Video resume: migration 016 applied on backend restart; frontend `tsc -b` and eslint clean; backend `npm test` 8/8. In the browser a temporary student paused video 1 at 43 s (stored `position_seconds` 43), reloaded and playback resumed at 43 s; leaving via Back to Videos while playing saved the new position. The first run exposed a missing `findPosition`/`savePosition` export in `videos.repository.js` (500 on `GET /api/videos/:id`), now fixed. The temporary account was deleted. Not run: integration suites, Playwright suite, end-of-video reset, 10 s periodic save, `pagehide` save.

Favourites/downloads dropdown: migration 017 applied; frontend `tsc -b` and eslint clean. In the browser a temporary student favourited a model (card heart, dashboard lists it) and a library item (heart on and off, `/api/favorites` reflected both), and the dashboard no longer shows "Available for you". A temporary teacher saw one Downloads select per model and no Enable/Disable buttons; changing it updated `is_downloadable` (restored afterwards). Temporary accounts deleted. Integration suites: see below if recorded; otherwise not run.

Dashboard unfavourite: `tsc -b` and eslint clean. In the browser a temporary student with a favourite model, video and library item clicked the first heart; that card disappeared without navigating and `/api/favorites` no longer listed it. Temporary account deleted. Not run: automated suites, undoing an unfavourite from the dashboard.

## Stored-file cleanup, password-check lockout and quiz delete protection — 25 October 2026

Changes: deleting a model, video or resource now removes its stored files (unless another row uses them); `npm run cleanup:orphans` lists/removes files nothing refers to; wrong passwords on change-password, delete-account and the two-factor password checks count toward the account lockout and return 429 while locked; deleting a quiz with attempts or an active session returns 409.

Checks actually run in this pass (local Postgres 16, local file storage, `DISABLE_RATE_LIMIT=true`): backend `npm run lint` clean (`--max-warnings 0`); `npm test` 40/40; `npm run test:integration` 83/83, including two new files. `fileCleanup.integration.test.js` uploads a model and a video through the API and confirms both files exist and are gone after delete; confirms a file shared by two rows survives the first delete and is removed with the second; confirms paths outside the upload folders, `..` paths, URLs and null are never removed; confirms deleting a link resource touches no file; and confirms the orphan finder skips referenced and recent files and `deleteOrphans` removes only the old orphan. `passwordLockout.integration.test.js` confirms four wrong current passwords are counted, the fifth locks the account, the right password and delete-account are then refused with 429 and the account survives; a correct password clears earlier failures; wrong passwords on delete-account and MFA setup are each counted; a quiz without attempts deletes (200) while one with an attempt or an active session returns 409 and keeps the attempt.

Not run: the S3 branch of file removal and of `listAssets` (only the local driver was exercised), resource file (non-link) upload-then-delete through the API, glTF-companion handling in the orphan finder, the frontend and Playwright suites, and a production-compose deployment. The first test run failed only because the test used an administrator account on teacher-only routes; the test was corrected, no product code changed for that. The frontend was not changed and does not yet show a special message for the 409 and 429 responses beyond the server's text.

## S3 storage test, lockout message and dev compose pass-through — 25 October 2026

`tests/s3Storage.test.js` (part of `npm test`) runs the S3 branches of `storage.js` against an in-memory bucket substituted for the SDK client: prefixed keys on write, stat of present and missing objects, listing across three pages, removal (including of a missing object) and refusal of `..` paths. It does not talk to real S3, so IAM permissions, `ListBucket` rights, real pagination limits and S3 consistency are still unverified. The password-check lockout response now says how many minutes remain, and the integration test checks the wording. The development `docker-compose.yml` now passes the MFA, quota, idle-timeout and lockout variables through. Quiz delete returning 409 is not reachable from the current UI (it only deletes quizzes abandoned during creation), and server messages already reach the user, so no frontend change was made. Checks run: backend lint clean, `npm test` 42/42, `npm run test:integration` 83/83; compose file parses as YAML, but `docker compose config` and a container start were not run.

## Image dimension checks, passkeys and committed browser tests — 25 October 2026

Changes: photos and generated thumbnails are refused above `IMAGE_MAX_DIMENSION` / `IMAGE_MAX_MEGAPIXELS` (sizes read from PNG, JPEG and WebP headers); passkeys (WebAuthn) as a second factor (migration 022, `@simplewebauthn/server` and `/browser`, profile card, login step); a self-contained Chromium suite in `anatolearn/tests/e2e` run by `npm run test:e2e` and a new CI job.

Checks actually run (local Postgres 16, local file storage): backend lint clean; `npm test` 46/46 (new `imageSize.test.js` covers header parsing for PNG, JPEG, WebP lossy/lossless/extended, over-limit and unreadable images, environment overrides, and upload validation); `npm run test:integration` 92/92, including `passkeys.integration.test.js`, which drives the real endpoints with a software authenticator (ES256, "none" attestation, CBOR encoded in the test helper): registration needs the password and counts wrong ones; wrong-origin and reused challenges are refused; a good assertion starts a session and updates the counter; replay, tampered signature, wrong origin, non-advancing counter and a junk token are refused (failures counted toward the lockout); an authenticator code cannot sign in a passkey-only account; the last factor cannot be removed while `MFA_REQUIRED=true`; an administrator's 2FA reset removes passkeys. Frontend `tsc -b`, lint, build and the `test:api`, `test:viewer`, `test:models` suites passed. `npm run test:e2e` passed 7/7 in Chromium: authenticator-app enrolment with recovery-code sign-in (plus an axe check of the profile page), adding a passkey in the real browser WebAuthn API through Chromium's virtual authenticator, signing in with it, removing it, a device without the credential failing to sign in, idle-session expiry, sign-out-everywhere, lockout from the change-password form (with the minutes-remaining message), a teacher seeing others' content read-only and claiming unowned content, and an administrator transferring content.

One existing assertion in `features.test.js` was fixed: it looked for the lockout event inside the newest 1000 audit rows and failed once the log was large, so it now filters by action.

Not run or not covered: the browser tests use Chromium only (no Firefox, WebKit or Edge) and a virtual authenticator, so real hardware keys, platform authenticators (Touch ID, Windows Hello, phone passkeys), Safari and cross-device passkey flows were not tried; passkeys over https on a real domain (the relying-party ID and origin settings) were exercised only for `localhost`; the new CI job itself has not run on GitHub yet; the existing Docker-based four-browser suite in `tests/browser` was not re-run; image-size limits were not tried with real large photographs through the UI, and a file whose header understates its pixel size is not detected.
