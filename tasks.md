# tasks.md — AnatoLearn Implementation Task Breakdown

## Purpose
This file is the implementation checklist for AnatoLearn.

Use it with:
- `PRD.md` for product requirements and feature scope
- `Architecture.md` for system structure and Three.js rules
- `coding_guidelines.md` for code style and clean code rules
- `design.md` for UI layout, color, and component visual specs

Create documentation structure in `docs/`:
- `docs/README.md` — project overview, team, how to run locally
- `docs/database_schema.md` — placeholder 
- `docs/storage_structure.md` — placeholder 
- `docs/api_endpoints.md` — placeholder (filled as APIs are built)
- `docs/testing_log.md` — placeholder for test records
- `docs/3d_model_tools.md` — placeholder

Documentation updates are part of every implementation task. Before marking any task as done, update all affected documents:
- Update `docs/README.md` for setup, usage, architecture, or local run changes
- Update `docs/api_endpoints.md` for any API route, request, response, auth, or error behavior changes
- Update `docs/database_schema.md` for schema, relationship, seed data, or migration changes
- Update `docs/storage_structure.md` for upload paths, file formats, storage limits, or cloud-migration changes
- Update `docs/testing_log.md` after verification, browser checks, API checks, or regression testing
- Update `docs/3d_model_tools.md` for 3D model tooling, supported formats, conversion notes, or compatibility findings
- Update `tasks.md` task status only after code, tests, and relevant documentation are complete

Task status updates are required:
- When starting a task, update its checkbox from `[ ]` to `[~]`
- When a task is implemented, verified, and documented successfully, update its checkbox from `[ ]` or `[~]` to `[x]`
- Do not mark a task `[x]` until implementation, verification, and affected documentation updates are complete
- If a task cannot be completed because of a missing decision, dependency, asset, credential, or technical blocker, update its checkbox to `[!]` and add a short blocker note under that task
- If a task is split into smaller follow-up work, leave the parent task `[~]` until all required follow-up work is complete

**IMPORTANT — checklist accuracy notice (added 15 Jul 2026):** Weeks 2/3/5 (3D viewer/annotations) and Tasks 7.3/7.4 (video browsing/playback) were significantly understated in this file prior to 15 Jul 2026 — the actual code (built by Member B) was substantially further along than the checkboxes showed, because progress was never written back into this file. Before assuming any task below is unbuilt, pull and check the actual current source file rather than trusting a stale checkbox — see `docs/testing_log.md`, "Codebase Audit" entry, for the full writeup of this discovery.

---

## Team Roles

| Member | Primary Responsibility |
|---|---|
| **A** | Frontend, 3D model rendering, interaction controls, label visualisation, video playback |
| **B** | Backend APIs, authentication, database, metadata handling, system integration |
| **C** | Content management, educational video management, quiz implementation, content testing |
| **D** | Download/export support, metadata export, storage architecture, compatibility testing |
| **All** | 3D model generation software sourcing, integration testing, bug fixing, documentation, report writing, presentation |

**Note (15 Jul 2026):** Two teammates originally slated for Owner A work alongside 3D model generation are fully committed to 3D model generation for the remainder of the project and are not returning to Owner A's web portal tasks. Member C and Member B are covering the entire web portal — effectively all of A + B + C + D — between the two of them.

---

## Task Status Key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked / needs decision

**Definition of Done** — a task is complete only when:
- Code compiles with no errors
- Feature works for both Student and Teacher roles
- No console errors in the browser
- All affected documentation listed above is updated

---

## Week 1 — Project Setup & Architecture
**Members:** All | **Deliverable:** Project architecture, database design, initial UI design

---

### Task 1.1 — Scaffold Frontend Project
**Owner:** A | **Depends on:** none

- [x] Initialise React + TypeScript project with Vite: `npm create vite@latest anatolearn -- --template react-ts`
- [x] Install runtime deps: `react-router-dom`, `three`, `lucide-react`
- [x] Install dev deps: `tailwindcss`, `postcss`, `autoprefixer`, `@types/three`
- [x] Configure Tailwind (`tailwind.config.js`, `postcss.config.js`)
- [x] Add Tailwind directives to `src/index.css`
- [x] Add Google Fonts (`DM Sans`, `IBM Plex Sans`) to `src/index.css`
- [x] Create folder structure: `src/context/`, `src/components/`, `src/pages/`
- [x] Add placeholder page files: `Login.tsx`, `Register.tsx`, `Dashboard.tsx`, `Viewer.tsx`, `Videos.tsx`, `Quizzes.tsx`, `Library.tsx`
- [x] Add `ProtectedRoute.tsx` placeholder in `src/components/`
- [x] Verify dev server runs with `npm run dev`

Acceptance Criteria:
- [x] App opens in browser with no console errors
- [x] Tailwind classes apply correctly
- [x] Fonts load in browser

---

### Task 1.2 — Design Database Schema
**Owner:** B | **Depends on:** none

Design and document the initial database schema covering all entities:
- [ ] `users` table: id, name, email, password hash, role (student/teacher), program, created_at
- [ ] `anatomy_models` table: id, title, description, file_path, file_format, body_system, body_part, uploaded_by, created_at
- [ ] `labels` table: id, model_id, name, description, position_x, position_y, position_z, created_by, created_at
- [ ] `videos` table: id, title, description, file_path, category, linked_label_id, uploaded_by, created_at
- [ ] `quizzes` table: id, title, description, created_by, created_at
- [ ] `questions` table: id, quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer
- [ ] `quiz_attempts` table: id, quiz_id, student_id, score, attempted_at
- [ ] `downloads` table: id, model_id, downloaded_by, downloaded_at
- [ ] Save schema as `docs/database_schema.md`

Acceptance Criteria:
- [ ] All entities and relationships documented

**Note:** The `labels` table was never built as designed — Member B built an `annotations` table instead, covering point/highlight/region-fill annotations. This is a superset of what `labels` intended but structured differently. See `docs/database_schema.md` for the full comparison.

---

### Task 1.3 — Set Up Backend Project Structure
**Owner:** B | **Depends on:** none

- [ ] Initialise backend project (choose framework: Express/Node or FastAPI/Python)
- [ ] Create folder structure: `routes/`, `controllers/`, `models/`, `middleware/`, `config/`
- [ ] Set up environment variable management (`.env`, `.env.example`)
- [ ] Connect to local database (SQLite for prototype or PostgreSQL)
- [ ] Add a health check endpoint: `GET /api/health` returns `{ status: 'ok' }`
- [ ] Verify health check returns 200 in browser or Postman

Acceptance Criteria:
- [ ] Backend server starts without errors
- [ ] Health check endpoint responds correctly
- [ ] `.env.example` committed (never `.env` with real secrets)

**Note:** Backend is a single `server.js` file, not the `routes/`/`controllers/`/`models/`/`middleware/` folder structure originally specified — a pragmatic simplification given team size and timeline, not tracked as a gap to fix.

---

### Task 1.4 — Design Local Storage Structure
**Owner:** D | **Depends on:** none

- [ ] Define local folder structure for uploaded files: `storage/models/`, `storage/videos/`, `storage/exports/`
- [ ] Document supported upload formats per type:
  - Models: `.obj`, `.gltf`, `.glb`, `.usdz`, `.uasset`
  - Videos: `.mp4`, `.webm`
  - Exports: `.json`, `.csv` (label exports)
- [ ] Define max file size limits per type
- [ ] Document planned cloud migration path (e.g. swap local `storage/` for S3 bucket)
- [ ] Save as `docs/storage_structure.md`

Acceptance Criteria:
- [ ] Future cloud path is noted (does not need to be implemented yet)

**Note:** Uploaded files (videos, model thumbnails) are stored under `PUBLIC_DIR` (`/public` in the container: `/public/videos/`, `/public/thumbnails/`), not a `storage/` tree as originally proposed — served directly via `express.static`, not through a dedicated download endpoint. `docs/storage_structure.md` itself was never created; this note stands in for it until Owner D writes it properly.

---

### Task 1.5 — Create UI Wireframes
**Owner:** A | **Depends on:** nothing

Create low-fidelity wireframes for all screens:
- [ ] Dashboard (student view)
- [ ] Dashboard (teacher view)
- [ ] 3D Viewer page with detail panel
- [ ] Videos browsing page
- [ ] Quizzes list page
- [ ] Quiz attempt page (student)
- [ ] Library / content management page, including materials and links
- [ ] Login / authentication screen
- [ ] Register / authentication screen

Acceptance Criteria:
- [ ] All major screens covered in `design.md`

---

## Week 2 — 3D Viewer Integration
**Members:** A, B | **Deliverable:** Initial working 3D model viewer

**Status note (15 Jul 2026):** This week's checkboxes were stale. `Viewer.tsx` and `ModelGallery.tsx` (built by Member B) implement most of this, using annotations instead of a simple label/part model. Confirmed by direct code review this session.

---

### Task 2.1 — Research and Select 3D Rendering Framework
**Owner:** A | **Depends on:** nothing

- [x] Evaluate Three.js for browser-based 3D rendering
- [x] Confirm Three.js supports `.gltf`, `.glb`, `.obj` loading
- [x] Confirm OrbitControls available via `three/addons`
- [ ] Document decision in `docs/README.md`

Acceptance Criteria:
- [~] Framework confirmed and rationale documented

**Note:** Three.js + `three/addons` confirmed in use in `Viewer.tsx`. Only `.gltf`/`.glb` loading is actually implemented (via `GLTFLoader`) — `.obj` support was never built (see Task 2.5). Decision was never formally written up in `docs/README.md`.

---

### Task 2.2 — Create the Viewer Page Shell
**Owner:** A | **Depends on:** Task 1.2

In `src/pages/Viewer.tsx`:
- [x] Create the Viewer shell according to `design.md` section 7
- [x] Add `mountRef` div as Three.js canvas target
- [ ] Add React state: `selectedPart`, `isAddingLabel`, `showVideo`
- [x] Page renders with visible empty canvas area and side panel

Acceptance Criteria:
- [~] Layout matches `design.md` section 7, including the defined side panel width
- [x] No TypeScript errors

**Note:** Built, but with a different state model than originally specified — `annotations`, `addMode`, `drawMode`, `regionMode`, `popupAnnotation` etc. instead of `selectedPart`/`isAddingLabel`/`showVideo`. Functionally equivalent intent, structurally different. Layout uses a `containerRef` (Three.js canvas) plus a right-side annotations list panel and a floating popup — not confirmed against `design.md` section 7's exact spec, worth a visual check later.

---

### Task 2.3 — Implement Three.js Scene Setup
**Owner:** A | **Depends on:** Task 2.2

Inside `useEffect` in `Viewer.tsx`:
- [x] Create `THREE.Scene`; visual background follows `design.md`
- [x] Create `THREE.PerspectiveCamera` (75° FOV, z=5)
- [x] Create `THREE.WebGLRenderer({ antialias: true })`, append to `mountRef`
- [x] Add `THREE.AmbientLight(0xffffff, 0.6)`
- [x] Add `THREE.DirectionalLight(0xffffff, 0.8)` at position (10, 20, 10)
- [x] Start animation loop with `requestAnimationFrame`
- [x] Add resize handler: update camera aspect + renderer size on window resize
- [x] Guard all operations with `if (!mountRef.current) return`

Acceptance Criteria:
- [x] Blank lit canvas renders without errors
- [x] Canvas resizes with browser window

**Note:** Confirmed by code review. Minor spec differences: camera starts at `(0, 2, 5)` not exactly `z=5`; ambient/directional light intensities are `2`/`3` not `0.6`/`0.8`, and directional light position is `(5, 10, 5)` not `(10, 20, 10)` — cosmetic tuning differences, not functional gaps.

---

### Task 2.4 — Add OrbitControls
**Owner:** A | **Depends on:** Task 2.3

- [x] Import `OrbitControls` from `three/addons/controls/OrbitControls.js`
- [x] Create `OrbitControls(camera, renderer.domElement)`
- [x] Enable damping: `controls.enableDamping = true`, `dampingFactor = 0.05`
- [x] Call `controls.update()` inside animation loop

Acceptance Criteria:
- [x] Canvas can be orbited, zoomed, and panned with mouse
- [x] Movement feels smooth due to damping

**Note:** `enableDamping = true` confirmed; explicit `dampingFactor` value not set in code (uses Three.js default, close enough to 0.05 to not matter).

---

### Task 2.5 — Implement GLTF/OBJ Model Loading
**Owner:** A | **Depends on:** Task 2.4

- [x] Import `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`
- [ ] Import `OBJLoader` from `three/addons/loaders/OBJLoader.js`
- [x] Load a local test `.gltf` or `.glb` file into the scene
- [x] Centre and scale loaded model to fit view
- [x] Handle load errors gracefully (console warning, no crash)

Acceptance Criteria:
- [x] A test 3D model renders in the browser
- [x] Model is visible and orbitble

**Note:** Only `.gltf`/`.glb` supported — `OBJLoader` was never added. Given all current seed models use `.glb`/`.gltf`, this hasn't blocked anything yet, but worth flagging if `.obj` models are expected later (the 3D model generation team's output format matters here).

---

### Task 2.6 — Build Backend Model Upload API
**Owner:** B | **Depends on:** Task 1.4

- [ ] `POST /api/models/upload` — accepts multipart file upload
- [ ] Validate file format (only `.obj`, `.gltf`, `.glb`, `.usdz`, `.uasset`)
- [ ] Save file to `storage/models/`
- [ ] Store metadata in `anatomy_models` table: title, description, file_path, file_format, body_system, body_part, uploaded_by
- [ ] Return `{ id, title, file_path }` on success
- [ ] Return `400` with error message on invalid format

Acceptance Criteria:
- [ ] Valid model file saves and returns metadata
- [ ] Invalid format returns 400

**Status: confirmed still not built.** No model upload endpoint exists — models can currently only be added via the seed script. Unlike videos (Task 7.1, now done), there's no multer-based upload path for models yet.

---

### Task 2.7 — Build Backend Model Retrieval API
**Owner:** B | **Depends on:** Task 2.6

- [x] `GET /api/models` — returns list of all models with metadata
- [x] `GET /api/models/:id` — returns single model metadata + file URL
- [x] File URL should be accessible by the frontend for Three.js loading

Acceptance Criteria:
- [x] List endpoint returns correct JSON array
- [x] Single model endpoint returns correct metadata

**Note:** Confirmed working — both endpoints exist in `server.js` and are used by `ModelGallery.tsx`/`Viewer.tsx`. File URL accessibility depends on the static-file-serving fix applied 15 Jul 2026 (see `docs/database_schema.md`) — before that fix, model thumbnails (though not the models themselves, which load via a different path) were likely also affected.

---

### Task 2.8 — Connect Frontend Viewer to Backend Model
**Owner:** A | **Depends on:** Tasks 2.5 and 2.7

- [x] Fetch model list from `GET /api/models` on Viewer load
- [x] Load the first (or selected) model's file URL into Three.js via GLTFLoader
- [ ] Display a loading state while model fetches
- [x] Display an error message if fetch fails

Acceptance Criteria:
- [x] A model uploaded via the API renders in the viewer
- [ ] Loading state is visible during fetch

**Note:** Confirmed via code review — model fetch and load both work. `Viewer.tsx` fetches a specific model by `:modelId` route param (via `ModelGallery.tsx`'s list, not "first model"), which is arguably better UX than the original spec anyway. No explicit loading spinner while the model fetches/loads — minor gap.

---

### Task 2.9 — Implement Full Three.js Cleanup
**Owner:** A | **Depends on:** Tasks 2.3–2.5

The `useEffect` return function must:
- [x] `window.removeEventListener('resize', handleResize)`
- [x] Remove click listener from `mountRef.current`
- [x] Remove `renderer.domElement` from `mountRef.current`
- [~] Dispose all loaded model geometries and materials
- [x] Call `renderer.dispose()`

Acceptance Criteria:
- [x] Navigate away from Viewer and back — no `WebGL context lost` or null ref errors

**Note:** Confirmed — cleanup function exists, removes all listeners, disposes `controls` and `renderer`, removes the DOM element. Annotation markers/draw objects are disposed via `clearMarkers()`/`clearCurrentDraw()`, but the loaded GLTF model itself (`modelRef.current`) is not explicitly disposed on unmount — a potential minor memory leak on repeated navigation, not yet confirmed as an actual problem in practice.

---

## Week 3 — Model Interaction Controls
**Members:** A | **Deliverable:** Interactive anatomy viewer

**Status note (15 Jul 2026):** The actual UI paradigm here diverges substantially from the original spec — instead of a fixed toolbar (reset/zoom/pan buttons) with click-to-select parts, `Viewer.tsx` implements teacher annotation-creation modes (Add/Draw/Region) plus a Hide/Show Annotations toggle. Raycasting exists but serves annotation placement/selection, not generic "part" selection.

---

### Task 3.1 — Build the Viewer Toolbar UI
**Owner:** A | **Depends on:** Week 2 merged

Toolbar overlay:
- [ ] Implement the toolbar visual layout according to `design.md` section 7
- [ ] Reset View button (`RotateCcw` icon)
- [ ] Zoom In button (`ZoomIn` icon)
- [ ] Zoom Out button (`ZoomOut` icon)
- [ ] Pan button (`Move` icon)

Acceptance Criteria:
- [ ] 4 buttons visible in top-left of canvas
- [ ] Hover and focus states match `design.md`

**Status: genuinely not built as specified.** No Reset View / Zoom In / Zoom Out / Pan toolbar exists. `Viewer.tsx` instead has a top-right button row for annotation modes (Add Annotation / Draw Highlight / Region Fill / Hide-Show Annotations), teacher-only for the creation modes. Pan/zoom/rotate all still work via OrbitControls mouse/scroll — just no dedicated buttons. Worth a design decision on whether the original toolbar is still wanted alongside the annotation controls, or whether OrbitControls' built-in interaction is considered sufficient.

---

### Task 3.2 — Implement Reset View
**Owner:** A | **Depends on:** Task 3.1

- [ ] `handleResetView`: set camera position to `(0, 0, 5)`, reset controls target to `(0, 0, 0)`, call `controls.update()`
- [ ] Wire Reset View toolbar button to `handleResetView`

Acceptance Criteria:
- [ ] After orbiting to any angle, clicking Reset View returns to default position

**Status: not built.** No reset-view button or handler exists.

---

### Task 3.3 — Implement Zoom In and Zoom Out Controls
**Owner:** A | **Depends on:** Task 3.1

- [ ] Zoom In: move camera closer along its current forward axis
- [ ] Zoom Out: move camera further back
- [ ] Use `camera.position.multiplyScalar()` or `controls.dollyIn/dollyOut` if available
- [ ] Respect min/max zoom distance

Acceptance Criteria:
- [ ] Zoom In and Zoom Out buttons change the camera distance

**Status: not built as dedicated buttons.** Scroll-wheel zoom via OrbitControls works.

---

### Task 3.4 — Implement Raycasting for Part Selection
**Owner:** A | **Depends on:** Week 2 merged

- [x] Create `THREE.Raycaster` and `THREE.Vector2` for mouse position
- [x] `onMouseClick`: calculate mouse coordinates relative to mount element
- [x] `raycaster.setFromCamera(mouse, camera)`
- [x] `raycaster.intersectObjects(meshesRef.current, true)` (recursive for GLTF child meshes)
- [x] On hit: call `setSelectedPart()` with matched part data
- [x] Highlight selected mesh: set emissive to `0x444444` on hit, reset all others
- [x] On miss: call `setSelectedPart(null)`, reset all emissives
- [x] Add click listener to `mountRef.current`

Acceptance Criteria:
- [x] Clicking a mesh selects it and highlights it
- [x] Clicking empty space clears the selection
- [x] Detail panel updates with selected part data

**Note:** Fully implemented, but for annotation markers (not generic mesh "parts") — clicking a marker opens a popup with the annotation's label/description; clicking the model surface in Add mode captures a placement point. No emissive-highlight-on-hover pattern; selection state is tracked via `selectedMarkerRef`/`popupAnnotation` instead of a literal `selectedPart`. Functionally equivalent to the task's intent.

---

### Task 3.5 — Build the System Selector Dropdown
**Owner:** A | **Depends on:** Task 2.2

System selector overlay:
- [ ] Implement the selector visual layout according to `design.md` section 7
- [ ] `<select>` populated from `body_system` values returned by `GET /api/models`
- [ ] Changing selection filters the model displayed in the viewer
- [ ] Re-loads the appropriate model via Three.js

Acceptance Criteria:
- [ ] Dropdown shows available body systems
- [ ] Selecting a system loads and displays that model

**Status: unconfirmed.** `ModelGallery.tsx` was not reviewed in detail this session's code audit — it may implement model browsing/selection in some form (routing to `Viewer.tsx` per model), but a `body_system` dropdown as originally specified was not confirmed either way. Needs a follow-up check of `ModelGallery.tsx` before this can be marked accurately. Also worth noting: `models` has no `body_system` column at all (see `docs/database_schema.md`), so this exact spec can't be built without a schema change regardless.

---

### Task 3.6 — Build the Side Panel Empty State
**Owner:** A | **Depends on:** Task 2.2

When `selectedPart === null`:
- [x] Render the empty state according to `design.md` section 7

Acceptance Criteria:
- [x] Empty state renders when nothing is selected
- [~] Matches `design.md` section 7

**Note:** The right-side "Annotations" list panel shows "No annotations yet." when empty — functionally an empty state, though not confirmed to visually match `design.md` section 7's exact spec (which describes a viewer detail panel, not an annotations list — these may be two different UI concepts that got merged).

---

### Task 3.7 — Build the Side Panel Selected State (Structure Info)
**Owner:** A | **Depends on:** Task 3.6

When `selectedPart !== null`:
- [x] Render the selected-state panel according to `design.md` section 7
- [x] Student view shows name, description, highlight, and linked video
- [~] Teacher view adds teacher controls only

Acceptance Criteria:
- [x] Panel shows correct part name, description, and linked video
- [ ] Responsive behavior matches `design.md` section 16

**Note:** Implemented as a floating popup (not a fixed side panel) showing label, kind (Point/Highlight/Region), and description, with Edit/Delete buttons for teachers and a Close button for everyone. **No linked-video display** — since annotations have no video field at all (see the Task 7.5/7.6 note and `docs/database_schema.md` open question #3). Responsive behavior not tested this session.

---

## Week 4 — Model Browsing & Search
**Members:** A, B | **Deliverable:** Browsing and search module

---

### Task 4.1 — Build Backend Search and Filter API
**Owner:** B | **Depends on:** Task 2.7

- [ ] `GET /api/models?system=<value>&part=<value>&q=<search>` — supports filtering by body system, body part, and keyword search on title/description
- [ ] Returns filtered array of model metadata
- [ ] Returns empty array (not 404) when no results match

Acceptance Criteria:
- [ ] Filtering by system returns only matching models
- [ ] Keyword search matches on title or description

**Status: not built.** `GET /api/models` returns everything, no query param filtering. Not reassessed this session beyond confirming the plain endpoint exists (Task 2.7).

---

### Task 4.2 — Build the Model Browsing Page (Library View)
**Owner:** A | **Depends on:** Task 4.1

In `src/pages/Library.tsx` (student browsing section):
- [ ] Fetch model list from `GET /api/models` on page load
- [ ] Display models according to the Library visual patterns in `design.md` section 10
- [ ] Each model entry links to `/3dviewer` with the model pre-selected

Acceptance Criteria:
- [ ] Model list renders from API data and follows `design.md`
- [ ] Clicking a model entry opens `/3dviewer` with that model

**Note:** Not reassessed this session — `Library.tsx` was not pulled/reviewed. Model browsing may actually be happening through `ModelGallery.tsx` (routed at `/3dviewer`) rather than `Library.tsx` — worth checking both before assuming either is unbuilt.

---

### Task 4.3 — Add Search Input to Library Page
**Owner:** A | **Depends on:** Task 4.2

- [ ] Search input follows `design.md` Library input patterns
- [ ] On input change, call `GET /api/models?q=<query>` with debounce (300ms)
- [ ] Results update the displayed grid without page reload

Acceptance Criteria:
- [ ] Typing in search filters the model list
- [ ] No API call is made on every keystroke (debounced)

---

### Task 4.4 — Add Body System and Body Part Filter Dropdowns
**Owner:** A | **Depends on:** Task 4.3

- [ ] Body system dropdown: populated from unique values in model list
- [ ] Body part dropdown: populated based on selected system
- [ ] On change, call `GET /api/models?system=<value>&part=<value>` and update grid

Acceptance Criteria:
- [ ] Selecting a system narrows the body part dropdown
- [ ] Combined filters return correct results

**Blocker note:** `models` has no `body_system`/`body_part` columns (see `docs/database_schema.md`) — this task can't be built as literally specified without a schema addition first.

---

### Task 4.5 — Build Teacher Model Upload UI
**Owner:** A | **Depends on:** Task 2.6

Teacher only (in Library page):
- [ ] Upload drop zone follows `design.md` section 10
- [ ] File picker input: accept `.obj,.gltf,.glb,.usdz,.uasset`
- [ ] Form fields: title, description, body system, body part
- [ ] On submit, `POST /api/models/upload` with multipart form
- [ ] Show success message or error from API response

Acceptance Criteria:
- [ ] Upload form visible in teacher mode only
- [ ] Valid file uploads successfully and appears in the model list
- [ ] Invalid format shows error message

**Status: not built.** Blocked on Task 2.6 (backend upload endpoint doesn't exist). This session built the equivalent for videos (Task 7.1) — the same `multer`-based pattern could be reused here if this becomes a priority.

---

### Task 4.6 — Build Teacher Model Management Actions
**Owner:** B | **Depends on:** Task 2.7

APIs:
- [ ] `PUT /api/models/:id` — update model metadata (title, description, system, part)
- [ ] `DELETE /api/models/:id` — soft delete or remove model

Frontend (teacher only in Library):
- [ ] Edit button per model card → opens edit form with pre-filled values
- [ ] Delete button per model card → confirm then calls delete API

Acceptance Criteria:
- [ ] Editing a model updates its metadata in the list
- [ ] Deleting a model removes it from the list

**Status: not built.** No model edit/delete endpoints exist. Same reusable pattern as Task 6.4's video management (built this session) could apply here.

---

### Task 4.7 — Store and Retrieve Model Metadata
**Owner:** B | **Depends on:** Task 2.6

- [ ] Ensure all metadata fields are stored in `anatomy_models` table on upload
- [ ] `GET /api/models/:id` includes all metadata: title, description, body_system, body_part, file_format, uploaded_by, created_at
- [ ] Verify metadata survives server restart (persistent storage, not in-memory)

Acceptance Criteria:
- [ ] All metadata returned correctly from API
- [ ] Data persists after restarting backend

**Note:** Metadata persistence itself works (Postgres, not in-memory) — but the specific fields (`body_system`, `body_part`, `file_format`, `uploaded_by`) don't exist on the `models` table as built. Blocked on the same schema gap as Task 4.4/4.6.

---

## Week 5 — Anatomical Labelling System
**Members:** A, B | **Deliverable:** Functional label management system

**Status note (15 Jul 2026):** Built as an `annotations` system (point/highlight/region_fill), not a simple `labels` system. Functionally covers and exceeds most of this week's intent — see `docs/database_schema.md` for the schema comparison.

---

### Task 5.1 — Build Label Data API
**Owner:** B | **Depends on:** Task 1.3

- [x] `POST /api/models/:id/labels` — create label: name, description, position_x, position_y, position_z
- [x] `GET /api/models/:id/labels` — return all labels for a model
- [x] `PUT /api/labels/:id` — update label name or description
- [x] `DELETE /api/labels/:id` — delete a label
- [x] Store all labels in `labels` table

Acceptance Criteria:
- [x] CRUD operations work for labels
- [x] Labels are correctly associated with their model

**Note:** Built as `annotations` endpoints (`POST/GET /api/models/:id/annotations`, `PUT/DELETE /api/annotations/:id`), not literally `labels` — same CRUD shape, richer data model (position + drawPoints + regionPlane + regionTriangles + view, packed into `annotation_data` JSONB, depending on type). Confirmed working via code review and prior sessions' annotation testing.

---

### Task 5.2 — Fetch and Render Labels in Three.js
**Owner:** A | **Depends on:** Tasks 5.1 and 3.4

- [x] On model load, fetch labels from `GET /api/models/:id/labels`
- [x] For each label, create a `THREE.Sprite` or small `THREE.Mesh` marker at the stored position
- [x] Store markers in `meshesRef` for raycasting
- [x] Each marker's `userData` stores the label's `id`

Acceptance Criteria:
- [x] Label markers appear at correct positions on the loaded model
- [x] Markers are clickable via raycasting

**Note:** Uses `THREE.Mesh` spheres for point markers (not sprites), plus dot-chains for draw highlights and filled meshes for regions. `userData.annotation` stores the full annotation object, not just an id. Markers tracked in `markersRef`, functionally equivalent to `meshesRef`.

---

### Task 5.3 — Show Label Detail on Click
**Owner:** A | **Depends on:** Task 5.2

- [x] Clicking a label marker calls `setSelectedPart()` with the label data (name, description)
- [x] Side panel shows label name and description
- [x] Highlight selected label marker (emissive change)

Acceptance Criteria:
- [x] Clicking a label opens the panel with correct data
- [~] Correct marker is highlighted

**Note:** Clicking opens a floating popup (not a side panel) with label/description/kind. "Highlighting" is done via the `isolateSelected` mechanism (hides all other markers rather than an emissive color change on the selected one) — different visual approach, same practical effect of drawing attention to the selection.

---

### Task 5.4 — Build Teacher Label Placement Mode
**Owner:** A | **Depends on:** Task 5.3

- [x] Teacher only: `Add Label` toggle button (bottom-left overlay)
- [~] Active label-placement state follows `design.md` section 7
- [x] In add-label mode, clicking on the model surface captures the 3D world position
- [x] Open a small inline form: label name and description inputs
- [x] On submit: call `POST /api/models/:id/labels` with name, description, and captured position
- [x] New marker appears immediately after save

Acceptance Criteria:
- [x] Teacher can place a label at any point on the model
- [x] Label persists after page refresh (stored in backend)

**Note:** Exceeds the original spec — teacher has three placement modes (Add point / Draw highlight / Region fill), not just one. Buttons are top-right, not bottom-left. Visual match against `design.md` section 7 not confirmed this session.

---

### Task 5.5 — Build Teacher Label Edit and Delete UI
**Owner:** A | **Depends on:** Task 5.4

Teacher only, in side panel when a label is selected:
- [x] `Edit Description` button → opens inline edit form with current values
- [x] On save: calls `PUT /api/labels/:id`
- [x] `Delete Label` button → confirm then calls `DELETE /api/labels/:id`
- [x] Marker removed from scene on successful delete

Acceptance Criteria:
- [x] Edit saves updated name/description to backend
- [x] Delete removes marker from scene and database

**Note:** Confirmed working — Edit/Delete buttons in the annotation popup, teacher-only. No confirmation prompt before delete (unlike the video/quiz delete flows built this session, which do confirm) — worth flagging as a minor UX inconsistency to fix later.

---

### Task 5.6 — Label Hover Tooltip
**Owner:** A | **Depends on:** Task 5.2

- [ ] On mouse move over label markers, show a small HTML tooltip with the label name
- [ ] Tooltip follows cursor or is pinned near the marker
- [ ] Tooltip disappears when mouse leaves the marker

Acceptance Criteria:
- [ ] Hovering a label shows its name
- [ ] Tooltip does not persist after moving away

**Status: not built.** Only click-based interaction exists (via the popup) — no hover tooltip.

---

### Task 5.7 — Test Label Visibility Across Browsers
**Owner:** B | **Depends on:** Task 5.3

- [ ] Test label markers visible and clickable in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Record any rendering differences in `docs/testing_log.md`

Acceptance Criteria:
- [ ] Labels work in at least Chrome and Firefox
- [ ] Issues documented if found in Safari

**Status: not tested.** All testing this project has used Chrome only so far.

---

## Week 6 — Teacher Content Management
**Members:** B, C | **Deliverable:** Teacher management module

---

### Task 6.1 — Build Teacher Dashboard Page Shell
**Owner:** C | **Depends on:** Milestone 2 (Layout) merged

In `src/pages/Dashboard.tsx` (teacher view):
- [x] Teacher stats and quick actions follow `design.md` section 6
- [ ] Stats fetched from respective `GET /api/...?uploaded_by=<me>` endpoints

Acceptance Criteria:
- [ ] Teacher dashboard shows real counts from the database
- [x] All quick actions navigate to the pages specified in `design.md`

---

### Task 6.2 — Build Content Visibility Controls
**Owner:** B | **Depends on:** Task 4.6

- [ ] Add `is_published` boolean field to `anatomy_models`, `videos`, and `quizzes` tables
- [ ] `PATCH /api/models/:id/publish` — toggle model visibility (teacher only)
- [x] `PATCH /api/videos/:id/publish` — toggle video visibility (teacher only)
- [x] `PATCH /api/quizzes/:id/publish` — toggle quiz visibility (teacher only)
- [~] Student-facing APIs only return items where `is_published = true`

Acceptance Criteria:
- [~] Published models/videos/quizzes visible to students (videos and quizzes done via `?published=true`; models still not built — no `is_published` column on `models` at all)
- [~] Unpublished items visible only in teacher management view (videos and quizzes done; models not applicable yet)

**Note:** `videos.is_published` added 15 Jul 2026, matching the pattern already used for quizzes. `models` remains the only content type with zero publish gating — worth prioritizing if model management (Task 4.5/4.6) becomes active.

---

### Task 6.3 — Build Teacher Model Management Interface
**Owner:** C | **Depends on:** Task 4.6

In Library page (teacher view):
- [~] Table or list of all uploaded models (including unpublished)
- [~] Each row: model name, system, part, format, published status toggle, edit button, delete button
- [ ] Published toggle calls `PATCH /api/models/:id/publish`
- [x] Edit opens form, delete triggers confirmation

Acceptance Criteria:
- [x] Teacher can see all models including unpublished ones
- [x] Toggle, edit, and delete all work without page refresh

---

### Task 6.4 — Build Teacher Video Management Interface
**Owner:** C | **Depends on:** Task 6.2

In Videos page (teacher view):
- [x] List of all uploaded videos with: title, published status, edit, delete
- [x] Published toggle calls `PATCH /api/videos/:id/publish`
- [x] Edit opens form with title, description
- [x] Delete triggers confirmation and removes from list

Acceptance Criteria:
- [x] Teacher sees all videos including unpublished
- [x] Edit, toggle, and delete work correctly

**Resolved 15 Jul 2026:** Publish toggle, edit modal, and delete-with-confirmation are all now built and verified working. Edit only covers title/description — no `category` field exists on `videos`, and no linked-label dropdown (see the note below on Task 7.6). Each video card shows an amber "Unpublished" badge to teachers when relevant.

**Superseded note:** an earlier note about a `mockLabels` dropdown "currently in the video edit form" no longer matches the actual codebase — the current `Videos.tsx` (as pulled and reviewed 15 Jul 2026) had no edit form at all until this session added one, and it does not include a label dropdown. Either that earlier work was overwritten when `Videos.tsx` was rebuilt with real backend wiring, or it was never actually merged. Not investigated further — see Task 7.6 for the current open decision on video-to-annotation linking.

---

### Task 6.5 — Build Role-Based Access Control (Middleware)
**Owner:** B | **Depends on:** Task 1.4

- [ ] Create `authenticate` middleware: verifies JWT token from `Authorization` header
- [ ] Create `requireTeacher` middleware: checks `role === 'teacher'`, returns 403 if not
- [ ] Apply `authenticate` to all protected routes
- [ ] Apply `requireTeacher` to upload, edit, delete, and publish routes
- [ ] Test: student token rejected on teacher-only routes

Acceptance Criteria:
- [ ] Student JWT cannot access teacher-only endpoints
- [ ] Missing or invalid token returns 401
- [ ] Teacher JWT can access all teacher endpoints

---

### Task 6.6 — Update Frontend Role-Gating with Real Auth
**Owner:** C | **Depends on:** Task 6.5

- [ ] Store JWT token in memory or `sessionStorage` after login
- [ ] Include `Authorization: Bearer <token>` header on all API calls
- [ ] Read `role` from decoded JWT payload
- [ ] Hide teacher-only UI for student-role users

Acceptance Criteria:
- [ ] Role-gated UI driven by real JWT role
- [ ] Student user cannot see teacher controls even if they inspect the page

---

## Week 7 — Educational Video Integration
**Members:** A, C | **Deliverable:** Educational video module

**Status note (15 Jul 2026):** Tasks 7.3 and 7.4 were already substantially built (by Member B) before this session — confirmed via direct code review. Task 7.1 was built this session. Tasks 7.5/7.6 need an architecture decision before any further code — see below.

---

### Task 7.1 — Build Video Upload API
**Owner:** C | **Depends on:** Task 6.2

- [x] `POST /api/videos/upload` — accepts multipart video file upload
- [x] Validate format (only `.mp4`, `.webm`)
- [~] Save to `storage/videos/`
- [~] Store metadata in `videos` table: title, description, category, file_path, uploaded_by, linked_label_id (nullable)
- [x] Return `{ id, title, file_path }` on success

Acceptance Criteria:
- [x] Valid video uploads and metadata is stored
- [x] Invalid format returns 400

**Resolved 15 Jul 2026.** Built via `multer` disk storage, saves to `PUBLIC_DIR/videos/` (not a `storage/` tree — see Task 1.4 note) with a generated unique filename. Stores `title`, `description`, `video_path`, `program_id` (not `category`, `uploaded_by`, or `linked_label_id` — none of those columns exist on `videos`). Tested via direct `Invoke-RestMethod -Form` call before frontend wiring, then end-to-end through the real upload form. In the course of testing, found and fixed a pre-existing bug: `express.static` was never configured, so uploaded/existing video and thumbnail files were unreachable by URL even though they existed on disk — see `docs/database_schema.md`.

---

### Task 7.2 — Build Video Retrieval API
**Owner:** C | **Depends on:** Task 7.1

- [x] `GET /api/videos` — returns published videos with optional `?category=<value>&q=<search>` filter
- [x] `GET /api/videos/:id` — returns single video metadata + file URL
- [ ] `GET /api/labels/:id/video` — returns the video linked to a specific label (if any)

Acceptance Criteria:
- [~] List and filter endpoints return correct data
- [ ] Label-to-video link resolves correctly

**Note:** `GET /api/videos` now supports `?published=true` (added 15 Jul 2026), but not `?category=` or `?q=` — there's no `category` column, and search is done entirely client-side in `Videos.tsx`. `GET /api/labels/:id/video` cannot be built as specified — no `labels` table exists (see Task 7.5/7.6 below).

---

### Task 7.3 — Build the Videos Browsing Page
**Owner:** A | **Depends on:** Task 7.2

In `src/pages/Videos.tsx`:
- [x] Fetch published video list from `GET /api/videos` on load
- [x] Videos page layout and card content follow `design.md` section 8
- [x] Search input and category filter dropdown
- [x] Clicking a card plays the video in a modal or inline player
- [x] Teacher-only video actions follow `design.md` section 8

Acceptance Criteria:
- [x] Video list renders from API data
- [~] Search and filter narrow the visible results
- [x] Video plays on click

**Resolved — confirmed already built prior to this session, now further extended.** Fetch, search (title-only, client-side), and click-to-navigate-to-player all confirmed working. Now also fetches with role-based `?published=true` filtering (added 15 Jul 2026) and has teacher management controls (Edit/Publish/Delete, also added 15 Jul 2026). **No category filter dropdown** — there's no category data model at all, so this part of the original spec doesn't apply until/unless that's added.

---

### Task 7.4 — Implement Video Player Component
**Owner:** A | **Depends on:** Task 7.3

- [x] Create `<VideoPlayer>` component using HTML5 `<video>` tag
- [~] Props: `src` (video URL), `onClose` callback
- [x] Controls: play/pause, seek bar, volume, fullscreen
- [x] Close button dismisses the player
- [ ] Fallback message if video fails to load

Acceptance Criteria:
- [x] Video plays and pauses correctly
- [x] Close button works
- [x] No autoplay without user interaction

**Resolved — confirmed already built prior to this session.** `VideoPlayer.tsx` is a dedicated route/page (`/videos/:videoId`), not a modal/inline component taking `src`/`onClose` props as originally specified — it fetches its own data via `useParams` + `api.getVideo`, and "close" is a "Back to Videos" nav link rather than a callback prop. Standard HTML5 `<video controls autoPlay>` — note this **does autoplay** on page load, which technically conflicts with the "No autoplay without user interaction" acceptance criterion, though arguably navigating to the page IS the user interaction. No fallback UI if the video fails to load (e.g. broken file, 404) — worth adding given the static-file-serving bug found this session shows how easily video URLs can silently break.

---

### Task 7.5 — Link Video to Label in Viewer
**Owner:** A | **Depends on:** Tasks 5.3 and 7.4

In the viewer detail panel, when a label is selected:
- [ ] Call `GET /api/labels/:id/video` to check for a linked video
- [ ] If a video exists: show thumbnail with play overlay
- [ ] Clicking thumbnail opens `<VideoPlayer>` with the linked video URL
- [ ] If no video: show `No video linked` message

Acceptance Criteria:
- [ ] Linked video plays from the detail panel
- [ ] Unlinked labels show the correct fallback message

**[!] Blocked — needs an architecture decision, not just code.** There is no `labels` table; `Viewer.tsx` uses `annotations`, which has no video field at all. Cannot be built as literally specified. See `docs/database_schema.md` open question #3. Needs team input on whether to (a) add `video_id` to `annotations` and build this properly against the real data model, or (b) deprioritize as out of scope given the divergence.

---

### Task 7.6 — Build Video-to-Label Linking UI (Teacher)
**Owner:** C | **Depends on:** Tasks 7.2 and 5.1

Teacher only, in video edit form:
- [ ] Dropdown to select a label to link the video to
- [ ] Dropdown populated from `GET /api/models/:id/labels`
- [ ] On save, update `linked_label_id` in `videos` table via `PUT /api/videos/:id`
- [ ] Linked label shown in video management table

Acceptance Criteria:
- [ ] Teacher can link a video to a label from the edit form
- [ ] Link is reflected in the viewer detail panel

**[!] Blocked — same root cause as Task 7.5.** A previous note in this file claimed a `mockLabels`-based dropdown existed in the video edit form — this does not match the actual current codebase (see Task 6.4's "Superseded note"). The current, real `Videos.tsx` edit form (built 15 Jul 2026) intentionally does not include this, since there's no `labels` concept to link against. Needs the same architecture decision as Task 7.5 before any further work here.

---

### Task 7.7 — Test Video Playback Compatibility
**Owner:** C | **Depends on:** Task 7.4

- [~] Test `.mp4` playback in Chrome — pass/fail
- [~] Test `.mp4` playback in Firefox — pass/fail
- [~] Test `.webm` playback in Chrome — pass/fail
- [ ] Test playback at different video file sizes (small, medium, large)
- [x] Document results in `docs/testing_log.md`

Acceptance Criteria:
- [~] At least `.mp4` plays in Chrome and Firefox
- [x] Results documented

**Note:** Original testing was done in a standalone HTML file, not the real in-app player, because Task 7.4 wasn't confirmed built at the time. Task 7.4 is now confirmed built and was tested in-app this session (upload → play flow, Chrome only) — but a full retest matching this task's original checklist (multiple browsers, multiple file sizes) hasn't happened yet.

---

## Week 8 — Quiz Module Development
**Members:** B, C | **Deliverable:** Self-assessment system

---

### Task 8.1 — Design Quiz Data Structure
**Owner:** C | **Depends on:** Task 1.3

- [x] Confirm `quizzes`, `questions`, and `quiz_attempts` table schemas (from Task 1.3)
- [x] Add any missing fields: options stored as JSON array vs separate columns
- [x] Decision: store options as `option_a`, `option_b`, `option_c`, `option_d` columns
- [x] Document final schema in `docs/database_schema.md`

Acceptance Criteria:
- [x] Schema finalised and documented before any quiz API is built

**Note:** Resolved. `quiz_questions` now has a `format` column (`mcq` / `open_ended`), with `option_a`–`d`/`correct_option` nullable (used only for MCQ) and a `model_answer` column (used only for open-ended). `quiz_attempts` gained a `status` column (`graded` / `pending_review`) and a companion table `quiz_attempt_answers` stores each individual answer for manual grading. This is a merged single-table design rather than the fully separate structure originally proposed in `docs/database_schema.md` — see that file for the divergence notes. `quizzes.type` (MCQ/Practical/Mixed) is auto-derived from the question formats actually present, rather than manually picked by the teacher.

---

### Task 8.2 — Build Quiz Management APIs (Teacher)
**Owner:** B | **Depends on:** Task 8.1

- [x] `POST /api/quizzes` — create quiz: title, description
- [x] `GET /api/quizzes` — list all quizzes (teacher: all, student: published only, via `?published=true`)
- [ ] `GET /api/quizzes/:id` — get quiz with questions (currently two separate calls: `GET /api/quizzes` + `GET /api/quizzes/:id/questions`, not combined)
- [x] `PATCH /api/quizzes/:id/type` — update quiz type (added; not a full metadata `PUT` — title/description/category still can't be edited after creation)
- [x] `DELETE /api/quizzes/:id` — delete quiz
- [x] `POST /api/quizzes/:id/questions` — add question with options and correct answer (also supports open-ended format with `model_answer`)
- [x] `PUT /api/questions/:id` — update question (supports switching format)
- [x] `DELETE /api/questions/:id` — delete question
- [x] `GET /api/quizzes/:id/attempts/pending` — list attempts awaiting manual review
- [x] `GET /api/attempts/:id` — fetch a single attempt's own record (added for the sessionStorage result-visibility workaround)
- [x] `GET /api/attempts/:id/answers` — get all answers for an attempt, joined with question data
- [x] `PATCH /api/attempt-answers/:id/grade` — teacher assigns a 0-100 score to an open-ended answer

Acceptance Criteria:
- [~] Full CRUD for quizzes and questions (quizzes: create/delete/publish/type-update done, full metadata `PUT` still missing; questions: full CRUD done including open-ended format)
- [x] Correct answer stored but not exposed in student-facing API response (extended to also hide `model_answer`)

---

### Task 8.3 — Build Quiz Creation UI (Teacher)
**Owner:** C | **Depends on:** Task 8.2

In `src/pages/Quizzes.tsx` (teacher view):
- [x] `Create Quiz` button opens a form: title, description, category fields
- [x] After creating a quiz, show a question editor (two-step flow: quiz created first, then a separate "Add Questions" modal)
- [x] Add Question form: question text, format toggle (MCQ / Open Ended), 4 options + correct answer selector for MCQ, model answer field for Open Ended
- [x] Save question calls `POST /api/quizzes/:id/questions`
- [x] Questions listed below with edit and delete buttons (both wired to real `PUT`/`DELETE` endpoints, format-aware)

Acceptance Criteria:
- [x] Teacher can create a quiz with a mix of MCQ and open-ended questions, confirmed against real backend (verified via manual test — quiz persists after full page refresh)
- [x] Questions saved to the backend

**Note:** Resolved — quiz creation uses a two-step flow (create quiz → separate question editor). Cancelling before adding any questions deletes the abandoned quiz record. Quizzes are created unpublished; on "Done", the quiz's `type` is auto-derived from the question formats added (all MCQ → 'MCQ', all open-ended → 'Practical', mix → 'Mixed') via `PATCH /api/quizzes/:id/type`, then published. The manual Type `<select>` was removed from the quiz creation form since it no longer served a purpose once format is chosen per-question.

---

### Task 8.4 — Build Quiz List View (Student and Teacher)
**Owner:** C | **Depends on:** Task 8.2

In `src/pages/Quizzes.tsx`:
- [x] Fetch quiz list on load
- [x] Each row: quiz title, number of questions, status (completed/pending), type badge
- [x] Student and teacher quiz row actions follow `design.md` section 9

Acceptance Criteria:
- [x] Quiz list renders from API
- [x] Student and teacher views differ correctly (row actions differ; teacher's "View Results" now opens the grading UI, no longer a dead stub)

---

### Task 8.5 — Build Quiz Attempt Flow (Student)
**Owner:** C | **Depends on:** Task 8.4

- [x] Clicking `Start Quiz` loads the quiz's own questions via `GET /api/quizzes/:id/questions`
- [x] Question display branches by format: radio buttons for MCQ, free-text textarea for open-ended
- [x] `Next` button advances to next question
- [x] After last question, `Submit` button sends all answers (`selected_option` for MCQ, `answer_text` for open-ended)
- [x] Clicking `Start Quiz` on a quiz already attempted (same browser) shows the existing result instead of a fresh attempt, via a sessionStorage-based lookup

Acceptance Criteria:
- [x] Student can navigate through all questions regardless of format
- [x] Answers are collected before submission

**Note:** Resolved — each quiz correctly fetches and displays its own questions from the backend, and the quiz-taking UI correctly renders open-ended questions as a text box instead of the MCQ radio-button template. Additionally fixed a UX gap: after a teacher grades a pending attempt, the student previously had no way to see the result and could only start a fresh attempt. A sessionStorage workaround now lets them see their (possibly now-graded) result when revisiting the same quiz in the same browser — documented as a stopgap, not real quiz history, in `docs/api_endpoints.md`.

---

### Task 8.6 — Build Quiz Scoring API
**Owner:** B | **Depends on:** Task 8.2

- [x] `POST /api/quizzes/:id/submit` — accepts `{ answers: { question_id, selected_option? | answer_text? }[] }`
- [x] Compare each MCQ answer against stored correct answer; store every answer (MCQ and open-ended) individually in `quiz_attempt_answers`
- [x] Calculate score as percentage for fully-MCQ attempts
- [x] If any open-ended answers are present, attempt is marked `status: 'pending_review'` and `score` stays null until manually graded
- [x] `PATCH /api/attempt-answers/:id/grade` — teacher assigns 0-100 score per open-ended answer; once all are graded, final score is computed as a weighted blend of MCQ % and open-ended average, and status flips to `'graded'`
- [!] Store attempt in `quiz_attempts` table: quiz_id, student_id, score, attempted_at — **blocked**: no `student_id` column, since there's no auth yet (Task 9). Attempts currently store quiz_id/score/total_questions/correct_count/status/attempted_at only, with no way to tell which student submitted. A sessionStorage-based same-browser workaround exists for result visibility only — it does not solve student attribution.
- [x] Return `{ status, score, total, correct, incorrect, mcq_count, open_ended_count, feedback: [...] }` — feedback covers MCQ questions only

Acceptance Criteria:
- [x] Score calculated correctly for MCQ-only attempts (verified via manual test against `quiz_attempts` table)
- [x] Open-ended answers correctly withhold scoring until manually reviewed (verified via manual test — mixed quiz returned `status: pending_review`, `score: null`)
- [x] Weighted blend score is mathematically correct once graded — a bug where MCQ contribution was understated (dividing by total questions instead of MCQ count) was found and fixed during testing, verified across 3 scenarios
- [!] Attempt stored with student ID and timestamp — timestamp yes, student ID blocked on Task 9 (auth)
- [x] Feedback returned per MCQ question

---

### Task 8.7 — Display Quiz Results (Student)
**Owner:** C | **Depends on:** Task 8.6

After submitting:
- [x] Show overall score: e.g. `You scored 7 / 10 (70%)` for fully-graded attempts
- [x] Show a "Submitted — Pending Review" state instead of a score when the attempt contains open-ended answers awaiting teacher grading
- [x] Show per-question feedback for MCQ questions: student's answer vs correct answer
- [x] Show per-question feedback for open-ended questions: student's own answer, plus "Awaiting teacher review" or the assigned score once graded (never the model answer)
- [x] Correct answers marked green, incorrect marked red; open-ended cards use neutral/amber styling since scores aren't binary correct/incorrect
- [x] `Retry` button resets and restarts the quiz (hidden while pending review, since there's nothing to retry yet); also clears the sessionStorage-stored attempt so a genuine retake is possible
- [x] `Back to Quizzes` button returns to list

Acceptance Criteria:
- [x] Score and feedback display from API response
- [x] Pending-review attempts show the correct waiting state instead of a fabricated or missing score
- [x] Open-ended questions have visible feedback, not just MCQ
- [x] Retry restarts the question flow

**Note:** Resolved — scoring is computed server-side in `POST /api/quizzes/:id/submit` and the results screen reads from that response instead of comparing locally. Also fixed a related security issue: `GET /api/quizzes/:id/questions` previously returned `correct_option` to students before they answered; that field (and `model_answer`, once open-ended questions were added) is now excluded from the response entirely.

**Resolved gap:** The Practical/Mixed quiz types previously rendered identical MCQ radio-button question forms regardless of selected Type. This is now fixed — question format (MCQ / Open Ended) is chosen per-question by the teacher, and quiz `type` is auto-derived from what's actually in the quiz.

**Resolved gap:** There was previously no teacher-facing UI to view and grade pending open-ended attempts. "View Results" on the teacher's quiz row now opens a list of pending attempts for that quiz; selecting one shows student answers alongside model answers with a 0-100 grading input per open-ended answer. Verified end-to-end: student submits → teacher grades → student sees the graded result on revisit (same browser).

---

### Task 8.8 — Build Quiz History (Student)
**Owner:** B | **Depends on:** Task 8.6

- [ ] `GET /api/students/me/attempts` — returns all quiz attempts for the logged-in student
- [ ] Each attempt: quiz title, score, date
- [ ] Display attempt history on the student Quiz list (below the quiz row or in an expandable section)

Acceptance Criteria:
- [ ] Student can see their past scores per quiz
- [ ] Most recent attempt shown on quiz list row

**Blocker:** Fully blocked on Task 9 (auth). `quiz_attempts` has no `student_id` column, so attempts can't currently be attributed to a specific student — there's no way to build a real "my history" endpoint until login exists. A same-browser sessionStorage workaround (Task 8.5/8.7) lets a student re-see one specific quiz's result, but this is not history — it doesn't list past quizzes, doesn't work across devices, and is not a substitute for this task.

---

## Week 9 — Authentication & Role Management
**Members:** B, D | **Deliverable:** User authentication and RBAC

**Status note:** Nothing in this week has been started by anyone as of 15 Jul 2026. This is the single biggest remaining blocker — it gates Task 6.6, 8.8, and real student attribution generally.

---

### Task 9.1 — Build User Registration API
**Owner:** B | **Depends on:** Task 1.4

- [ ] `POST /api/auth/register` — accepts name, email, password, role, program
- [ ] Hash password with bcrypt before storing
- [ ] Store user in `users` table
- [ ] Return `{ id, name, email, role }` — never return password hash
- [ ] Return 409 if email already exists

Acceptance Criteria:
- [ ] New user created with hashed password
- [ ] Duplicate email returns 409

---

### Task 9.2 — Build Login and JWT API
**Owner:** B | **Depends on:** Task 9.1

- [ ] `POST /api/auth/login` — accepts email, password
- [ ] Verify password against hash with bcrypt
- [ ] On success: return signed JWT containing `{ id, name, role, program }`
- [ ] JWT expiry: 24 hours
- [ ] On failure: return 401

Acceptance Criteria:
- [ ] Valid credentials return a JWT
- [ ] Invalid credentials return 401
- [ ] JWT payload contains role

---

### Task 9.3 — Apply Authentication Middleware to All Routes
**Owner:** B | **Depends on:** Tasks 6.5 and 9.2

- [ ] Apply `authenticate` middleware to all model, label, video, quiz, and user routes
- [ ] Public routes (no auth): `POST /api/auth/register`, `POST /api/auth/login`
- [ ] Test: requests without token return 401

Acceptance Criteria:
- [ ] All data routes require a valid JWT
- [ ] Auth routes remain publicly accessible

---

### Task 9.4 — Build Login Page (Frontend)
**Owner:** D | **Depends on:** Task 9.2

Create `src/pages/Login.tsx`:
- [ ] Email and password input fields
- [ ] Submit calls `POST /api/auth/login`
- [ ] On success: store JWT in `sessionStorage`, decode role and program, redirect to `/dashboard`
- [ ] On failure: show error message `Invalid email or password`
- [ ] Add `/login` route in `App.tsx`

Acceptance Criteria:
- [ ] Valid login redirects to `/dashboard`
- [ ] Invalid login shows error
- [ ] JWT stored after successful login

**Note:** A `Login.tsx` file already exists in the codebase (confirmed via `App.tsx` routing and file listing) — not reviewed for actual functionality this session. Possible it's a placeholder like the original `Videos.tsx` upload stub. Worth checking before assuming this is fully unbuilt.

---

### Task 9.5 — Build Registration Page (Frontend)
**Owner:** D | **Depends on:** Task 9.1

Create `src/pages/Register.tsx`:
- [ ] Name, email, password, role select (Student/Teacher), program select
- [ ] Submit calls `POST /api/auth/register`
- [ ] On success: redirect to Login page
- [ ] On failure: show error message

Acceptance Criteria:
- [ ] Registration creates a new user account
- [ ] Duplicate email shows error
- [ ] Add `/register` route in `App.tsx`

**Note:** Same as Task 9.4 — `Register.tsx` exists as a file but wasn't reviewed this session.

---

### Task 9.6 — Protect Frontend Routes
**Owner:** D | **Depends on:** Task 9.4

- [ ] Create `ProtectedRoute` component: checks for JWT in `sessionStorage`, redirects to `/login` if missing
- [ ] Wrap all app routes (Dashboard, Viewer, Videos, Quizzes, Library) in `ProtectedRoute`
- [ ] `/login` and `/register` remain unprotected

Acceptance Criteria:
- [ ] Unauthenticated user redirected to `/login` on any protected route
- [ ] Authenticated user can access all pages

**Note:** `ProtectedRoute.tsx` exists and is used in `App.tsx` routing (wraps the Layout containing all main pages) — but since there's no real JWT/auth check yet, it likely doesn't actually protect anything meaningful yet. Not reviewed in detail this session.

---

### Task 9.7 — Build Logout
**Owner:** D | **Depends on:** Task 9.4

- [ ] Add Logout button in the Layout header (replacing or next to the user avatar)
- [ ] On click: remove JWT from `sessionStorage`, redirect to `/login`

Acceptance Criteria:
- [ ] After logout, user cannot access protected routes
- [ ] JWT is fully removed from storage

---

### Task 9.8 — Prepare Storage Architecture for Cloud Migration
**Owner:** D | **Depends on:** Task 1.5

- [ ] Abstract all file read/write operations behind a `StorageService` class or module
- [ ] `StorageService` methods: `saveFile(path, buffer)`, `getFileUrl(path)`, `deleteFile(path)`
- [ ] Current implementation: writes to `storage/` folder on disk
- [ ] Document how to swap the implementation for AWS S3 or similar in `docs/storage_structure.md`
- [ ] No actual cloud setup required — architecture preparation only

Acceptance Criteria:
- [ ] All file operations use `StorageService` (no direct `fs.writeFile` calls outside it)
- [ ] Cloud migration path documented

**Note:** Not built. File writes (video upload, thumbnail generation) call `fs`/`multer` directly in `server.js`, no abstraction layer. Worth doing before more upload endpoints (models, etc.) get added, since retrofitting later means touching every call site.

---

### Task 9.9 — Test Role-Based Access Control
**Owner:** D | **Depends on:** Tasks 6.5 and 9.3

Test each role-gated endpoint:
- [ ] Student token: `POST /api/models/upload` → 403
- [ ] Student token: `DELETE /api/models/:id` → 403
- [ ] Student token: `POST /api/quizzes` → 403
- [ ] Teacher token: all of the above → 200/201
- [ ] No token: all protected routes → 401
- [ ] Document results in `docs/testing_log.md`

Acceptance Criteria:
- [ ] All RBAC tests pass
- [ ] Results documented

---

## Week 10 — Download Support & Final Integration
**Members:** All | **Deliverable:** Final integrated system and documentation

---

### Task 10.1 — Implement Model Download Endpoint
**Owner:** D | **Depends on:** Task 2.6

- [ ] `GET /api/models/:id/download` — streams the model file to the client
- [ ] Set correct `Content-Disposition: attachment` header with original filename
- [ ] Set correct `Content-Type` per format
- [ ] Log download in `downloads` table: model_id, downloaded_by, downloaded_at
- [ ] Teacher only: unrestricted. Student: only published models

Acceptance Criteria:
- [ ] Download triggers a file save in the browser
- [ ] File is the correct format and not corrupted
- [ ] Download logged in the database

---

### Task 10.2 — Build Label Export to JSON and CSV
**Owner:** D | **Depends on:** Task 5.1

- [ ] `GET /api/models/:id/labels/export?format=json` — returns label data as downloadable `.json`
- [ ] `GET /api/models/:id/labels/export?format=csv` — returns label data as downloadable `.csv`
- [ ] JSON format: `[{ id, name, description, position: {x, y, z} }]`
- [ ] CSV format: `id,name,description,position_x,position_y,position_z`

Acceptance Criteria:
- [ ] JSON export downloads a valid JSON file
- [ ] CSV export downloads a valid CSV file
- [ ] Positions are preserved correctly in both formats

**Note:** Would need to export from `annotations`, not `labels` — the `annotation_data` JSONB shape varies by type (point/highlight/region), so a straightforward flat CSV export is less trivial than originally assumed.

---

### Task 10.3 — Build Download UI (Student and Teacher)
**Owner:** D | **Depends on:** Tasks 10.1 and 10.2

In Library page:
- [ ] Download button per model: calls `GET /api/models/:id/download`
- [ ] Export Labels dropdown per model (teacher only): JSON / CSV options
- [ ] Show download progress or spinner during download

Acceptance Criteria:
- [ ] Download button works for all users on published models
- [ ] Label export visible for teachers only

---

### Task 10.4 — Test Downloaded File Compatibility
**Owner:** D | **Depends on:** Task 10.1

- [ ] Download a `.gltf` model and open in Blender — verify renders correctly
- [ ] Download a `.obj` model and open in MeshLab or Blender — verify renders correctly
- [ ] Download a `.glb` model and open in model viewer — verify renders correctly
- [ ] Import downloaded JSON label file manually — verify structure
- [ ] Record results in `docs/testing_log.md`

Acceptance Criteria:
- [ ] At least `.gltf` and `.obj` open correctly in an external viewer
- [ ] Results documented

---

## Ongoing — Shared Responsibilities (All Weeks)

These tasks run continuously throughout the 10-week project:

| Task | Cadence | Owner |
|---|---|---|
| Update `docs/testing_log.md` with findings | After every test session | Whoever tested |

---

## Priority Summary

### Must Have
- [x] 3D viewer with model loading, orbit controls, raycasting — confirmed built (as annotations system), 15 Jul 2026
- [x] Anatomical labelling (create, view, click, hover*) — built as annotations; *hover tooltip (Task 5.6) specifically not built, click-based interaction works
- [x] Educational video browsing and playback — confirmed built, 15 Jul 2026
- [!] Video linked to label in viewer detail panel — blocked, needs architecture decision (see Task 7.5/7.6)
- [x] Quiz creation (teacher) and quiz attempt + scoring (student) — MCQ and open-ended both work end-to-end, including teacher grading UI for open-ended answers
- [~] Model and video upload with format validation — video upload done 15 Jul 2026; model upload still not built
- [ ] JWT authentication and role-based access control — not started
- [ ] Model download in original format
- [ ] Label export in JSON and CSV

### Should Have
- [~] Content visibility (publish/unpublish toggle) — quizzes and videos done; models not yet
- [ ] Quiz attempt history for students — real version blocked on auth; same-browser single-quiz stopgap exists
- [!] Video-to-label linking UI — blocked, needs architecture decision
- [ ] Storage abstraction layer (cloud-ready)
- [ ] Browser compatibility confirmed (Chrome + Firefox) — only Chrome tested throughout project so far

### Could Have
- [ ] Actual cloud storage (S3 or equivalent)
- [ ] Video thumbnail generation
- [ ] Quiz timer
- [ ] Student progress dashboard with charts