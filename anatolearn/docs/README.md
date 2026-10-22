# AnatoLearn

A web-based interactive 3D anatomy learning platform for health science education, developed for SIT's Health and Social Sciences Cluster (ITP Team SE_12).

## Overview

AnatoLearn lets students explore labelled 3D anatomical models directly in the browser, watch linked educational videos, and test their knowledge with self-assessment quizzes. Teachers can upload models, place and manage anatomical labels, link videos to specific structures, and build quizzes — all through a role-gated interface (Student / Teacher).

## Team

| Name | Role | Responsibility |
|---|---|---|
| Wong Hoi Young Ryan | Member A | Frontend, 3D model rendering, interaction controls, label visualisation, video playback |
| Timothy Jeremy Tay | Member B | Backend APIs, authentication, database, metadata handling, system integration |
| Natalie Chia Shuxian | Member C | Content management, educational video management, quiz implementation, content testing |
| Thian Yu Xuan Raynard | Member D | Download/export support, metadata export, storage architecture, compatibility testing |

**Industry Supervisor:** Dr. Suresh (SIT, Health and Social Sciences Cluster)
**Academic Supervisor:** Nisha Jain

## Tech Stack

- **Frontend:** React 19 + TypeScript, built with Vite
- **Styling:** Tailwind CSS (custom fonts: DM Sans for display text, IBM Plex Sans for body text)
- **Routing:** react-router-dom v7
- **3D Rendering:** Three.js (see rationale below)
- **Icons:** lucide-react
- **Backend:** Express 4, PostgreSQL 16 through pg, JWT/bcrypt authentication, Multer uploads and local static-file storage

## Getting Started (Local Setup)

### Prerequisites
- Node.js (LTS recommended)
- npm
- Docker Desktop, for the full frontend/backend/PostgreSQL stack

### Installation

```bash
# from the repo root
cd anatolearn

# install dependencies
npm install

# start the local dev server
npm run dev
```

The app will be available at the URL Vite prints in the terminal (typically `http://localhost:5173/`).

### Full Docker setup

```bash
# from the repo root
cd anatolearn

# build and start frontend, backend, and PostgreSQL
docker compose up --build
```

The PostgreSQL service creates the `anatolearn` database automatically and runs the SQL scripts in `backend/sql` on first startup:

- `001_schema.sql`
- `002_seed.sql`
- `003_add_users.sql` through `010_video_captions.sql`

These scripts are mounted read-only into `/docker-entrypoint-initdb.d`, which the official PostgreSQL image runs only when the database volume is empty. If a local `postgres_data` volume already exists, Docker keeps the existing database and does not rerun the init scripts. For a clean development reset:

```bash
docker compose down -v
docker compose up --build
```

Only use the volume reset command when local database contents can be deleted.

### Other useful commands

```bash
npm run build     # type-checks and builds a production bundle
npm run preview   # locally preview the production build
npm run lint      # run ESLint
```

## Framework Decisions

### 3D Rendering: Three.js



## Project Structure

```
anatolearn/
├── src/
│   ├── assets/          # Static assets (images, etc.)
│   ├── components/     # Shared components (Layout, ProtectedRoute, etc.)
│   ├── context/         # React context (AppContext — role/program state)
│   ├── pages/           # Route-level pages (Dashboard, Viewer, Videos, Quizzes, Library, Login, Register)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── docs/                # Project documentation (this folder)
├── public/
└── package.json
```

## Documentation Index

- [`database_schema.md`](./database_schema.md)  — database schema (pending, see Task 1.2)
- [`storage_structure.md`](./storage_structure.md)  — file storage structure and formats (pending, see Task 1.4)
- [`api_endpoints.md`](./api_endpoints.md) — API route reference *(pending, see Task 1.3)*
- [`testing_log.md`](./testing_log.md)  — browser/compatibility test records
- [`3d_model_tools.md`](./3d_model_tools.md) — 3D model generation tooling notes *(pending, see Objective 6 / shared responsibility: sourcing open-source 3D model generation software)*

## Viewer refactor on optimizingViewer (21 Oct 2026)
The Viewer uses a single interaction mode (view/point/highlight/region), typed annotation records/payloads/drafts, and a data-only useViewerContent hook. Shared domain types live in src/types/anatomy.ts; components/viewer/types.ts re-exports them for compatibility. Annotation conversion and draft updates are pure helpers. Scene mutation and resource ownership remain in Viewer.tsx; the earlier annotationVisuals controller has been folded back into the Viewer to follow project architecture. Projection helpers receive plain camera snapshots, and draggable panels report drag state through callbacks instead of receiving OrbitControls. Role-gated UI reads AppContext directly.
Model requests ignore responses after navigation. Scene cleanup cancels render/thumbnail frames and disposes model geometry/materials/textures, including late GLTF results. Annotation saving uses a shared payload/material-update path, blocks duplicate submissions, catches create/edit failures, and ignores scene updates after navigation. Model API-loading failures and invalid route IDs have visible messages. GLTF asset failures retain the existing console reporting.
Run `npm run test:viewer` for 10 focused Node regression tests (Node 22 with experimental type stripping; the Docker Node 22 runtime supports this). `npm run build` passes. Focused ESLint has no errors and two inherited Viewer effect-dependency warnings. A large production bundle warning remains. No API endpoints, database tables, or storage formats changed.

### Smaller Viewer entry point (21 Oct 2026)
Viewer.tsx has been reduced from the previous working refactor's 1,413 lines to 1,167 lines (246 fewer, about 17%). It now delegates annotation form state, validation, save locking and API persistence to useAnnotationEditor, and UI composition to ViewerOverlay. Overlay-local state owns list expansion and linked-video dialogs. createAnnotationBadge paints the numbered canvas badge while the actual Three.js texture stays owned by Viewer. Shared hit-target cleanup removes duplicated disposal code. No scene objects are passed to these extracted modules; Viewer keeps raycasting, model/camera operations and resource disposal.
Build and all 10 Viewer regression tests pass. Focused lint has no errors and the same two Viewer effect-dependency warning sites (one now also lists the captured editor controller). Browser checks cover edit/save/cancel, projected highlight creation, linked video, list collapse/expand, student controls and canvas removal on navigation. Changes are organizational, with no API/database changes or demonstrated rendering-speed improvement.

### Viewer under 1,000 lines (21 Oct 2026)
Further reduced Viewer.tsx from 1,167 to 972 lines (195 fewer). loadViewerAnnotations coordinates typed API records, sequential rendering callbacks and persistence of newly generated geometry caches. It receives only plain annotations/callbacks, never a scene or renderer. Neutral-view persistence lives in useViewerContent; deletion persistence lives in useAnnotationEditor. Viewer reuses one camera-application method and one selection matcher, and synchronizes a single mode ref instead of three derived boolean refs. Scene creation, raycasting, rendering, camera changes and cleanup stay in Viewer.tsx.
`npm run test:viewer` now has 16 passing tests, adding loading-order/cache-reuse, canceled/stale response, mid-cache cancellation, cache-write failure recovery, load failure and selection coverage. Production build passes. Focused lint retains two Viewer effect-dependency warnings with zero errors. No API/schema or content-storage format changes.

### Viewer drawing/events extraction (21 Oct 2026)
Viewer.tsx is now 859 lines, down from 972 in the previous step (113 fewer). drawingSamples/useDrawingSamples own plain screen/world coordinate samples, mesh indices and preview state; they copy input/snapshot data and retain the original jitter threshold. bindViewerEvents owns only DOM subscriptions and returns a cleanup function. Projected annotation metadata uses a shared factory; visual creation, painted-hit filtering and mesh disposal share local paths. Three.js resources and operations remain in Viewer.tsx. Deferred region generation is canceled/guarded during scene cleanup.
`npm run test:viewer` now passes 21 cases, including sampling, coordinate normalization, event unsubscribe behavior and projected defaults. Build passes. Focused lint has no errors and two existing effect-dependency warning sites, with new callbacks/controllers listed as appropriate. Docker is rebuilt after verification; no API/schema/upload format changes.

### Shared basic annotation rendering (21 Oct 2026)
Viewer.tsx is now 810 lines, down from 859 (49 fewer). basicAnnotationVisuals returns plain rendering descriptions for points and legacy drawings/regions. One local renderer creates and registers their Three.js resources. Model clicks and drawing gestures share canvas normalization and raycasting. Scene objects, resource ownership and disposal stay inside Viewer. This reduces duplication without claiming a rendering-speed improvement.

### Final Viewer consolidation (21 Oct 2026)
Viewer.tsx is now 760 physical lines, down from 810 (50 fewer). Scene insertion and collection registration share one typed local helper; annotation hotspots and hit targets use consolidated construction and metadata assignment; plain anatomy points use one Vector3 conversion path; annotation focus and neutral-view restoration share camera synchronization. Every Three.js object is still created, owned and disposed inside Viewer.tsx.

## Current architecture and design reference (21 October 2026)

The repository-root [Architecture.md](../../Architecture.md) now documents the implemented React/Express/PostgreSQL system, routes, contexts, authentication, API/storage boundaries, quiz grading and modular viewer. [design.md](../../design.md) records the current light/dark slate-and-blue theme, page layouts, viewer overlays and source-defined responsive behavior. Both explicitly distinguish current limitations from original requirements; the historical viewer refactor entries below describe earlier snapshots.

The backend is implemented in `backend/src/server.js` with `pg`, JWT/bcrypt authentication and Multer uploads. Docker runs PostgreSQL 16 and Node 22 development services. Registration returns an account and redirects to Login; Login returns the bearer token and user. Frontend role comes from that user response, and programme selection filters lists; backend student access remains scoped to the authenticated account programme and shared content. `npm run test:viewer` currently defines 22 focused cases; earlier test counts in this document are historical.

## Documentation ownership (21 October 2026)

Root Agents.md now defines one main coding agent and its workflow. Product/role, visual and QA acceptance obligations moved into PRD.md section 13; detailed engineering rules, core type contracts and the initial-build sequence moved into coding_guidelines.md section 17. Architecture.md remains a description of the current implementation. This reorganisation does not change product scope or resolve existing differences between requirements and code.


## Access, assessments and materials update — 22 October 2026

Apply the additive migration to an existing local database without resetting its volume:

```powershell
Get-Content backend/sql/008_access_and_assessments.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U anatolearn -d anatolearn
docker compose up -d frontend backend
```

The migration has already been applied in this workspace. Existing models begin with downloads disabled. Teachers open a card/row's **Content permissions and settings** to assign its programme, enable model downloads or set a quiz timer (seconds; blank is untimed). Students can access published content for their account programme and shared content. The selected programme further filters lists and counts; it does not grant cross-programme access.

Login now sets an HttpOnly media cookie as well as returning the existing bearer token. Sign in again if an older browser session cannot load images/videos/models. Logout clears the cookie. API and assets use same-origin paths; local Vite proxies to localhost:5000 and Docker uses BACKEND_URL=http://backend:5000. FRONTEND_ORIGINS configures allowed credentialed origins. Polling watchers handle Windows Docker bind mounts. Teaching files are not served/copied by Vite's public directory; production must proxy authenticated asset routes and must never expose the storage directory directly.

Supported uploads: GLB, embedded glTF, OBJ geometry and USDZ models; MP4/WebM video; PDF/DOC/DOCX and PNG/JPEG/WebP materials. Convert multi-file glTF or Unreal UASSET to GLB before upload. Model parser coverage and limitations are documented in [3d_model_tools.md](3d_model_tools.md); storage policy is in [storage_structure.md](storage_structure.md).

Teachers can attach an optional English WebVTT (`.vtt`, UTF-8, up to 2 MiB) caption file during video upload or add/replace/remove it from Edit Video. Learners get a native caption track on standalone playback and linked-video playback. Existing databases must apply migration 010 before the updated backend starts; no data-volume reset is needed.

Teachers save a quiz question to the bank, search/edit its body-system category and import copies into new quizzes. Timed student attempts use server-created sessions; submission/grading are transactional. Existing attempts/active sessions protect quiz questions from modification; create a revised quiz instead. View Results includes graded and pending attempts, and students can review their own answers from history.

```powershell
docker compose exec -T frontend npm run build
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test:viewer
docker compose exec -T frontend npm run test:models
docker compose exec -T backend npm test
docker compose exec -T backend npm run test:integration
```

Integration tests create and clean only isolated temporary records/files; they require the migrated local database. Historical viewer test counts and architecture notes earlier in this file describe older snapshots. Current behavior is documented in root Architecture.md/design.md and the latest testing_log.md entry.


## Session lifecycle and backups (22 October 2026)

Existing databases must apply `backend/sql/009_session_lifecycle.sql` after 008 before running this backend. From this directory in PowerShell:

```powershell
Get-Content backend/sql/009_session_lifecycle.sql | docker compose exec -T postgres psql -U anatolearn -d anatolearn -v ON_ERROR_STOP=1
Get-Content backend/sql/010_video_captions.sql | docker compose exec -T postgres psql -U anatolearn -d anatolearn -v ON_ERROR_STOP=1
docker compose exec -T backend npm run maintenance
.\ops\Backup.ps1 -VerifyRestore
```

Migration 009 requires users with previously issued tokens to sign in again. Login sessions expire after 24 hours; logout revokes the current session. Untimed quiz sessions expire after 24 hours by default. Maintenance runs at startup and hourly, removing closed session records after 30 days, while retaining attempts and answers. Optional environment settings: `QUIZ_SESSION_LIFETIME_HOURS` (1–168), `SESSION_RETENTION_DAYS` (1–365).

The backup command briefly stops backend writes and restarts a previously running backend automatically. Keep PostgreSQL running and prevent independent database/file writers during the snapshot. It creates `backups/snapshot-yyyyMMdd-HHmmss/` with database.dump, assets.tar.gz, file hashes and row counts. `-VerifyRestore` creates a separate `restore_snapshot_...` database and `restored-assets/` folder, validates archive/file checksums and compares restored row counts. Existing restore targets are never replaced; a repeat verification requires a new target. The verified clone remains available for inspection and has not been connected to the app.

To verify an existing snapshot, run `docker compose --profile ops run --rm --no-deps operations bash /ops/snapshot.sh verify snapshot-yyyyMMdd-HHmmss` with the real snapshot name and unused restore targets. This is an isolated restore tool; switching production to restored data is a separate maintenance operation. Before any live recovery, invalidate restored login sessions or rotate JWT_SECRET so old backed-up tokens cannot regain access. Backups contain private accounts and teaching content; store them with appropriate host permissions and copy them to protected external storage for disaster recovery. Linux archive permissions do not configure Windows ACLs. This implementation provides on-demand backups, not an unattended schedule or off-site storage.

`responsive-qa.html` is a local development viewport harness; sign in using disposable QA fixtures and inspect pages at 375, 768 and 1440 pixels. The normal production build contains only the application entry, not the harness.


## Viewer reliability verification

Run `docker compose exec -T frontend npm run test:viewer` for numeric framing, annotation translation, drawing, async-loading and event cleanup regressions. The current suite has 26 cases; ESLint has no remaining viewer effect warnings. The production viewer chunk still exceeds Vite's size warning threshold.

For isolated browser checks, run `docker compose exec -T backend node tests/viewer-fixture.js`. It prints disposable teacher/student account identifiers (password `Testing123`) and model IDs. The glTF contains two transformed meshes with an embedded checker texture; the fixture includes a linked point/video and saved projected region. Use `docker compose exec -T backend node tests/viewer-fixture.js cleanup` afterward; cleanup removes only recorded fixture IDs/files and generated thumbnails. A pre-existing fixture manifest must be cleaned before another is created. No production seed or teaching record is changed by setup/cleanup.

Viewer callbacks stay current through Effect Events; model metadata updates preserve the live canvas. Loading/error states and annotation form feedback are visible. Reset handles damping, default framing fits portrait views and the canvas tracks container resizing. Browser/GPU limits are recorded in testing_log.md.


## Accessibility and recovery verification

Docker Desktop can run the app with `docker compose up -d` from this directory. All three development services were running again at the end of this pass. Use `docker compose exec -T frontend npm run test:api` for client error handling and protected download/session regressions, alongside build/lint and existing viewer/model suites.

Main pages now show separate loading, failure/retry and successful-empty states. Dashboard, list and supporting history/favourite reads ignore responses from superseded programme/filter requests. Login distinguishes server outages from invalid credentials; protected download 401s clear expired identity too. Registration waits for available programme choices before submitting; teacher self-registration and assigned-programme/shared student access remain unchanged.

Keyboard users can skip navigation, use the compact menu with Escape, complete named authoring fields and stay within modal dialogs. Background interaction/scrolling is blocked while a modal is open. Read failures persist until retried; quiz draft finalize/discard failures remain visible instead of closing the editor. See testing_log.md for actual verification, including a controlled backend stop/start and keyboard-only quiz submission. The saved error/retry screenshot deliberately shows the simulated outage, not the current service state.


Screen-reader and browser acceptance procedures, current environment limits and an explicit evidence matrix are maintained in [accessibility_compatibility.md](accessibility_compatibility.md). Titles, route status, auth landmarks and annotation selection/expansion semantics have additional Chromium accessibility-tree checks. An accessibility tree does not establish actual spoken output or Firefox/Safari compatibility.


## Automated browser and accessibility checks

The host-side Playwright suite runs against the local Docker app; Node 22+ and Docker CLI access are required. From `anatolearn/`, install with `npm ci`. In PowerShell install the additional engines into the ignored project directory:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.playwright-browsers'
npx playwright install firefox webkit
docker compose up -d
npm run test:browser
npm run test:browser:summary
```

Chrome and Edge projects use the installed stable browser channels. `npm run test:browser -- --project=firefox` selects one project; `npm run test:browser:report` opens the HTML report. Tests create disposable teacher/student accounts and published model/quiz/video fixtures through the local backend fixture script, then remove only the recorded fixture in global teardown. Runs use one worker to avoid sharing a student's live quiz session concurrently. A pre-existing backend fixture prevents setup. After an interrupted run, `node -e "import('./tests/browser/teardown.mjs').then(m=>m.default())"` performs ownership-checked cleanup using the ignored local manifest; retain it until cleanup succeeds.

The suite checks auth semantics, five sections for both roles in both themes, modal focus/isolation, compact navigation, viewer annotation/video interaction, keyboard quiz submission/results and simulated read failure/retry. Axe reports use WCAG 2 A/AA and 2.1 A/AA tags. Reports include incomplete/manual-review findings as well as violations; passing automated checks is not complete accessibility certification. WebKit is an engine check, not an actual Safari/VoiceOver run. Test traces may contain temporary authentication data: generated binaries, manifests and reports are ignored by Git/Docker, excluded from lint and Vite polling, and denied by Vite. Do not publish raw traces.

The summary command writes a sanitized, shareable outcome to `docs/verification/browser-accessibility-summary.json`, without raw page HTML, request headers or authentication traces. It retains explicit skipped/limited checks and axe manual-review rule IDs.
