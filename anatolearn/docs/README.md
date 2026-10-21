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
- **Backend:** *(to be documented once implemented — see Task 1.3)*

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
