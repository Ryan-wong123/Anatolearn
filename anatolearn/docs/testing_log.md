# Testing Log

## Issue 26 — Expanded Learning Dashboard
Date: 24 Aug 2026
Tester: Codex

### Validation performed

| Check | Result |
|---|---|
| Backend JavaScript syntax (`node --check src/server.js`) | Pass |
| Focused ESLint (`Dashboard.tsx`, `api.ts`) | Pass |
| Vite production bundle (`npx vite build`) | Pass; existing bundle-size warning only |
| Full TypeScript build (`npm run build`) | Blocked by pre-existing unused `clampCameraOutsideModel` in `Viewer.tsx` |
| Repository-wide ESLint (`npm run lint`) | Blocked by pre-existing errors in viewer components, contexts, `Library.tsx`, `Quizzes.tsx`, and `Viewer.tsx` |

The summary SQL was reviewed to confirm that quiz statistics and recent attempts use only `req.user.id`, with no request parameter capable of selecting another student. Loading, API error with retry, no-attempt, no-featured-content, and populated rendering paths are implemented. Runtime API/database testing was not performed because no configured PostgreSQL service or authenticated fixture was available in this workspace.


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
`express.static` was never configured — see `docs/database_schema.md` "Static file serving" section for the full writeup. This was a pre-existing bug (predates this round), not something introduced by the upload work, but it was blocking video playback entirely and had to be fixed before upload testing could be considered meaningful.

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
- **Important, not yet resolved:** `src/api/api.ts` sends no `Authorization` header on any request, and there's no logged-in state yet (`Login.tsx` is a stub). This means the currently-running frontend (Dashboard, Videos, Quizzes, Library, 3D Viewer — everything) will start receiving 401s on every page the moment this backend change is deployed. This is expected given the task sequence (9.4-9.6 are the frontend wiring), but it's a real, visible breakage, not just a documentation gap — see `docs/api_endpoints.md`'s Auth section for the full note.
- Two routes were classified as `authenticate`-only rather than `requireTeacher` as judgment calls, not explicit spec: `PATCH /api/models/:id/thumbnail` (auto-triggered for any viewer, not just teachers) and `GET /api/attempts/:id` / `GET /api/attempts/:id/answers` (used by both the teacher grading UI and the student sessionStorage result-check workaround). See `docs/api_endpoints.md` for the reasoning.
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

## Known Issues Found — 20 Jul 2026 (logged, not yet fixed)
Date: 20 Jul 2026
Tester: 

### Issue 1: Teachers can submit and grade their own quiz
`POST /api/quizzes/:id/submit` requires `authenticate` only — no check that the caller is a student. Found this by logging in as a teacher, using the dev-mode role toggle to display the Student view of a quiz she created, and successfully submitting an attempt. Confirmed at the code level: the route has no `requireStudent`-style guard (only `requireTeacher` exists as a role-check middleware; there's no equivalent for restricting *to* students). Per `PRD.md`'s role table (FR-15/section 6), only students should be able to take quizzes — teachers are explicitly excluded. This is a real RBAC gap, not just a dev-toggle quirk: even without the dev toggle, nothing stops a teacher's real JWT from calling this endpoint directly.

**Not yet fixed.** Options to consider: add a `requireStudent` middleware (mirroring `requireTeacher`) and apply it to `POST /api/quizzes/:id/submit`, or decide this is acceptable (e.g. if teachers previewing/testing their own quiz is considered a feature, not a bug) — worth a deliberate decision either way rather than defaulting to "fix it," since PRD doesn't explain *why* teachers are excluded.

### Issue 2: Quizzes auto-publish immediately on creation
 noticed a newly created quiz already shows "Unpublish" (i.e. is published) right after finishing creation, with no separate manual publish step. **This is not a new bug** — it's documented, intentional behavior from 15 Jul 2026 (see Task 8.3's note in `tasks.md`): quizzes are created unpublished, but auto-publish once the teacher clicks "Done" after adding questions. Flagging here because Found it surprising when encountering it fresh — worth a deliberate decision on whether this is the desired UX (matches how a teacher might expect to "finish creating" to mean "ready for students") or whether quiz creation should leave quizzes unpublished by default, matching how model/video upload work (both start unpublished, requiring an explicit separate publish action).

**Not yet changed** — no action taken tonight, pending the decision on which behavior is actually wanted.

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
