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

---

## Team Roles

| Member | Primary Responsibility |
|---|---|
| **A** | Frontend, 3D model rendering, interaction controls, label visualisation, video playback |
| **B** | Backend APIs, authentication, database, metadata handling, system integration |
| **C** | Content management, educational video management, quiz implementation, content testing |
| **D** | Download/export support, metadata export, storage architecture, compatibility testing |
| **All** | 3D model generation software sourcing, integration testing, bug fixing, documentation, report writing, presentation |

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
- Relevant documentation updated

---

## Week 1 — Project Setup & Architecture
**Members:** All | **Deliverable:** Project architecture, database design, initial UI design

---

### Task 1.1 — Scaffold Frontend Project
**Owner:** A | **Depends on:** none

- [ ] Initialise React + TypeScript project with Vite: `npm create vite@latest anatolearn -- --template react-ts`
- [ ] Install runtime deps: `react-router-dom`, `three`, `lucide-react`
- [ ] Install dev deps: `tailwindcss`, `postcss`, `autoprefixer`, `@types/three`
- [ ] Configure Tailwind (`tailwind.config.js`, `postcss.config.js`)
- [ ] Add Tailwind directives to `src/index.css`
- [ ] Add Google Fonts (`DM Sans`, `IBM Plex Sans`) to `src/index.css`
- [ ] Create folder structure: `src/context/`, `src/components/`, `src/pages/`
- [ ] Add placeholder page files: `Login.tsx`, `Register.tsx`, `Dashboard.tsx`, `Viewer.tsx`, `Videos.tsx`, `Quizzes.tsx`, `Library.tsx`
- [ ] Add `ProtectedRoute.tsx` placeholder in `src/components/`
- [ ] Verify dev server runs with `npm run dev`

Acceptance Criteria:
- [ ] App opens in browser with no console errors
- [ ] Tailwind classes apply correctly
- [ ] Fonts load in browser

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

---

### Task 2.1 — Research and Select 3D Rendering Framework
**Owner:** A | **Depends on:** nothing

- [ ] Evaluate Three.js for browser-based 3D rendering
- [ ] Confirm Three.js supports `.gltf`, `.glb`, `.obj` loading
- [ ] Confirm OrbitControls available via `three/addons`
- [ ] Document decision in `docs/README.md`

Acceptance Criteria:
- [ ] Framework confirmed and rationale documented

---

### Task 2.2 — Create the Viewer Page Shell
**Owner:** A | **Depends on:** Task 1.2

In `src/pages/Viewer.tsx`:
- [ ] Create the Viewer shell according to `design.md` section 7
- [ ] Add `mountRef` div as Three.js canvas target
- [ ] Add React state: `selectedPart`, `isAddingLabel`, `showVideo`
- [ ] Page renders with visible empty canvas area and side panel

Acceptance Criteria:
- [ ] Layout matches `design.md` section 7, including the defined side panel width
- [ ] No TypeScript errors

---

### Task 2.3 — Implement Three.js Scene Setup
**Owner:** A | **Depends on:** Task 2.2

Inside `useEffect` in `Viewer.tsx`:
- [ ] Create `THREE.Scene`; visual background follows `design.md`
- [ ] Create `THREE.PerspectiveCamera` (75° FOV, z=5)
- [ ] Create `THREE.WebGLRenderer({ antialias: true })`, append to `mountRef`
- [ ] Add `THREE.AmbientLight(0xffffff, 0.6)`
- [ ] Add `THREE.DirectionalLight(0xffffff, 0.8)` at position (10, 20, 10)
- [ ] Start animation loop with `requestAnimationFrame`
- [ ] Add resize handler: update camera aspect + renderer size on window resize
- [ ] Guard all operations with `if (!mountRef.current) return`

Acceptance Criteria:
- [ ] Blank lit canvas renders without errors
- [ ] Canvas resizes with browser window

---

### Task 2.4 — Add OrbitControls
**Owner:** A | **Depends on:** Task 2.3

- [ ] Import `OrbitControls` from `three/addons/controls/OrbitControls.js`
- [ ] Create `OrbitControls(camera, renderer.domElement)`
- [ ] Enable damping: `controls.enableDamping = true`, `dampingFactor = 0.05`
- [ ] Call `controls.update()` inside animation loop

Acceptance Criteria:
- [ ] Canvas can be orbited, zoomed, and panned with mouse
- [ ] Movement feels smooth due to damping

---

### Task 2.5 — Implement GLTF/OBJ Model Loading
**Owner:** A | **Depends on:** Task 2.4

- [ ] Import `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`
- [ ] Import `OBJLoader` from `three/addons/loaders/OBJLoader.js`
- [ ] Load a local test `.gltf` or `.glb` file into the scene
- [ ] Centre and scale loaded model to fit view
- [ ] Handle load errors gracefully (console warning, no crash)

Acceptance Criteria:
- [ ] A test 3D model renders in the browser
- [ ] Model is visible and orbitble

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

---

### Task 2.7 — Build Backend Model Retrieval API
**Owner:** B | **Depends on:** Task 2.6

- [ ] `GET /api/models` — returns list of all models with metadata
- [ ] `GET /api/models/:id` — returns single model metadata + file URL
- [ ] File URL should be accessible by the frontend for Three.js loading

Acceptance Criteria:
- [ ] List endpoint returns correct JSON array
- [ ] Single model endpoint returns correct metadata

---

### Task 2.8 — Connect Frontend Viewer to Backend Model
**Owner:** A | **Depends on:** Tasks 2.5 and 2.7

- [ ] Fetch model list from `GET /api/models` on Viewer load
- [ ] Load the first (or selected) model's file URL into Three.js via GLTFLoader
- [ ] Display a loading state while model fetches
- [ ] Display an error message if fetch fails

Acceptance Criteria:
- [ ] A model uploaded via the API renders in the viewer
- [ ] Loading state is visible during fetch

---

### Task 2.9 — Implement Full Three.js Cleanup
**Owner:** A | **Depends on:** Tasks 2.3–2.5

The `useEffect` return function must:
- [ ] `window.removeEventListener('resize', handleResize)`
- [ ] Remove click listener from `mountRef.current`
- [ ] Remove `renderer.domElement` from `mountRef.current`
- [ ] Dispose all loaded model geometries and materials
- [ ] Call `renderer.dispose()`

Acceptance Criteria:
- [ ] Navigate away from Viewer and back — no `WebGL context lost` or null ref errors

---

## Week 3 — Model Interaction Controls
**Members:** A | **Deliverable:** Interactive anatomy viewer

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

---

### Task 3.2 — Implement Reset View
**Owner:** A | **Depends on:** Task 3.1

- [ ] `handleResetView`: set camera position to `(0, 0, 5)`, reset controls target to `(0, 0, 0)`, call `controls.update()`
- [ ] Wire Reset View toolbar button to `handleResetView`

Acceptance Criteria:
- [ ] After orbiting to any angle, clicking Reset View returns to default position

---

### Task 3.3 — Implement Zoom In and Zoom Out Controls
**Owner:** A | **Depends on:** Task 3.1

- [ ] Zoom In: move camera closer along its current forward axis
- [ ] Zoom Out: move camera further back
- [ ] Use `camera.position.multiplyScalar()` or `controls.dollyIn/dollyOut` if available
- [ ] Respect min/max zoom distance

Acceptance Criteria:
- [ ] Zoom In and Zoom Out buttons change the camera distance

---

### Task 3.4 — Implement Raycasting for Part Selection
**Owner:** A | **Depends on:** Week 2 merged

- [ ] Create `THREE.Raycaster` and `THREE.Vector2` for mouse position
- [ ] `onMouseClick`: calculate mouse coordinates relative to mount element
- [ ] `raycaster.setFromCamera(mouse, camera)`
- [ ] `raycaster.intersectObjects(meshesRef.current, true)` (recursive for GLTF child meshes)
- [ ] On hit: call `setSelectedPart()` with matched part data
- [ ] Highlight selected mesh: set emissive to `0x444444` on hit, reset all others
- [ ] On miss: call `setSelectedPart(null)`, reset all emissives
- [ ] Add click listener to `mountRef.current`

Acceptance Criteria:
- [ ] Clicking a mesh selects it and highlights it
- [ ] Clicking empty space clears the selection
- [ ] Detail panel updates with selected part data

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

---

### Task 3.6 — Build the Side Panel Empty State
**Owner:** A | **Depends on:** Task 2.2

When `selectedPart === null`:
- [ ] Render the empty state according to `design.md` section 7

Acceptance Criteria:
- [ ] Empty state renders when nothing is selected
- [ ] Matches `design.md` section 7

---

### Task 3.7 — Build the Side Panel Selected State (Structure Info)
**Owner:** A | **Depends on:** Task 3.6

When `selectedPart !== null`:
- [ ] Render the selected-state panel according to `design.md` section 7
- [ ] Student view shows name, description, highlight, and linked video
- [ ] Teacher view adds teacher controls only

Acceptance Criteria:
- [ ] Panel shows correct part name, description, and linked video
- [ ] Responsive behavior matches `design.md` section 16

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

---

### Task 4.7 — Store and Retrieve Model Metadata
**Owner:** B | **Depends on:** Task 2.6

- [ ] Ensure all metadata fields are stored in `anatomy_models` table on upload
- [ ] `GET /api/models/:id` includes all metadata: title, description, body_system, body_part, file_format, uploaded_by, created_at
- [ ] Verify metadata survives server restart (persistent storage, not in-memory)

Acceptance Criteria:
- [ ] All metadata returned correctly from API
- [ ] Data persists after restarting backend

---

## Week 5 — Anatomical Labelling System
**Members:** A, B | **Deliverable:** Functional label management system

---

### Task 5.1 — Build Label Data API
**Owner:** B | **Depends on:** Task 1.3

- [ ] `POST /api/models/:id/labels` — create label: name, description, position_x, position_y, position_z
- [ ] `GET /api/models/:id/labels` — return all labels for a model
- [ ] `PUT /api/labels/:id` — update label name or description
- [ ] `DELETE /api/labels/:id` — delete a label
- [ ] Store all labels in `labels` table

Acceptance Criteria:
- [ ] CRUD operations work for labels
- [ ] Labels are correctly associated with their model

---

### Task 5.2 — Fetch and Render Labels in Three.js
**Owner:** A | **Depends on:** Tasks 5.1 and 3.4

- [ ] On model load, fetch labels from `GET /api/models/:id/labels`
- [ ] For each label, create a `THREE.Sprite` or small `THREE.Mesh` marker at the stored position
- [ ] Store markers in `meshesRef` for raycasting
- [ ] Each marker's `userData` stores the label's `id`

Acceptance Criteria:
- [ ] Label markers appear at correct positions on the loaded model
- [ ] Markers are clickable via raycasting

---

### Task 5.3 — Show Label Detail on Click
**Owner:** A | **Depends on:** Task 5.2

- [ ] Clicking a label marker calls `setSelectedPart()` with the label data (name, description)
- [ ] Side panel shows label name and description
- [ ] Highlight selected label marker (emissive change)

Acceptance Criteria:
- [ ] Clicking a label opens the panel with correct data
- [ ] Correct marker is highlighted

---

### Task 5.4 — Build Teacher Label Placement Mode
**Owner:** A | **Depends on:** Task 5.3

- [ ] Teacher only: `Add Label` toggle button (bottom-left overlay)
- [ ] Active label-placement state follows `design.md` section 7
- [ ] In add-label mode, clicking on the model surface captures the 3D world position
- [ ] Open a small inline form: label name and description inputs
- [ ] On submit: call `POST /api/models/:id/labels` with name, description, and captured position
- [ ] New marker appears immediately after save

Acceptance Criteria:
- [ ] Teacher can place a label at any point on the model
- [ ] Label persists after page refresh (stored in backend)

---

### Task 5.5 — Build Teacher Label Edit and Delete UI
**Owner:** A | **Depends on:** Task 5.4

Teacher only, in side panel when a label is selected:
- [ ] `Edit Description` button → opens inline edit form with current values
- [ ] On save: calls `PUT /api/labels/:id`
- [ ] `Delete Label` button → confirm then calls `DELETE /api/labels/:id`
- [ ] Marker removed from scene on successful delete

Acceptance Criteria:
- [ ] Edit saves updated name/description to backend
- [ ] Delete removes marker from scene and database

---

### Task 5.6 — Label Hover Tooltip
**Owner:** A | **Depends on:** Task 5.2

- [ ] On mouse move over label markers, show a small HTML tooltip with the label name
- [ ] Tooltip follows cursor or is pinned near the marker
- [ ] Tooltip disappears when mouse leaves the marker

Acceptance Criteria:
- [ ] Hovering a label shows its name
- [ ] Tooltip does not persist after moving away

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

---

## Week 6 — Teacher Content Management
**Members:** B, C | **Deliverable:** Teacher management module

---

### Task 6.1 — Build Teacher Dashboard Page Shell
**Owner:** C | **Depends on:** Milestone 2 (Layout) merged

In `src/pages/Dashboard.tsx` (teacher view):
- [ ] Teacher stats and quick actions follow `design.md` section 6
- [ ] Stats fetched from respective `GET /api/...?uploaded_by=<me>` endpoints

Acceptance Criteria:
- [ ] Teacher dashboard shows real counts from the database
- [ ] All quick actions navigate to the pages specified in `design.md`

---

### Task 6.2 — Build Content Visibility Controls
**Owner:** B | **Depends on:** Task 4.6

- [ ] Add `is_published` boolean field to `anatomy_models`, `videos`, and `quizzes` tables
- [ ] `PATCH /api/models/:id/publish` — toggle model visibility (teacher only)
- [ ] `PATCH /api/videos/:id/publish` — toggle video visibility (teacher only)
- [ ] `PATCH /api/quizzes/:id/publish` — toggle quiz visibility (teacher only)
- [ ] Student-facing APIs only return items where `is_published = true`

Acceptance Criteria:
- [ ] Published models/videos/quizzes visible to students
- [ ] Unpublished items visible only in teacher management view

---

### Task 6.3 — Build Teacher Model Management Interface
**Owner:** C | **Depends on:** Task 4.6

In Library page (teacher view):
- [ ] Table or list of all uploaded models (including unpublished)
- [ ] Each row: model name, system, part, format, published status toggle, edit button, delete button
- [ ] Published toggle calls `PATCH /api/models/:id/publish`
- [ ] Edit opens form, delete triggers confirmation

Acceptance Criteria:
- [ ] Teacher can see all models including unpublished ones
- [ ] Toggle, edit, and delete all work without page refresh

---

### Task 6.4 — Build Teacher Video Management Interface
**Owner:** C | **Depends on:** Task 6.2

In Videos page (teacher view):
- [ ] List of all uploaded videos with: title, category, linked label, published status, edit, delete
- [ ] Published toggle calls `PATCH /api/videos/:id/publish`
- [ ] Edit opens form with title, category, linked label dropdown
- [ ] Delete triggers confirmation and removes from list

Acceptance Criteria:
- [ ] Teacher sees all videos including unpublished
- [ ] Edit, toggle, and delete work correctly

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

---

### Task 7.1 — Build Video Upload API
**Owner:** C | **Depends on:** Task 6.2

- [ ] `POST /api/videos/upload` — accepts multipart video file upload
- [ ] Validate format (only `.mp4`, `.webm`)
- [ ] Save to `storage/videos/`
- [ ] Store metadata in `videos` table: title, description, category, file_path, uploaded_by, linked_label_id (nullable)
- [ ] Return `{ id, title, file_path }` on success

Acceptance Criteria:
- [ ] Valid video uploads and metadata is stored
- [ ] Invalid format returns 400

---

### Task 7.2 — Build Video Retrieval API
**Owner:** C | **Depends on:** Task 7.1

- [ ] `GET /api/videos` — returns published videos with optional `?category=<value>&q=<search>` filter
- [ ] `GET /api/videos/:id` — returns single video metadata + file URL
- [ ] `GET /api/labels/:id/video` — returns the video linked to a specific label (if any)

Acceptance Criteria:
- [ ] List and filter endpoints return correct data
- [ ] Label-to-video link resolves correctly

---

### Task 7.3 — Build the Videos Browsing Page
**Owner:** A | **Depends on:** Task 7.2

In `src/pages/Videos.tsx`:
- [ ] Fetch published video list from `GET /api/videos` on load
- [ ] Videos page layout and card content follow `design.md` section 8
- [ ] Search input and category filter dropdown
- [ ] Clicking a card plays the video in a modal or inline player
- [ ] Teacher-only video actions follow `design.md` section 8

Acceptance Criteria:
- [ ] Video list renders from API data
- [ ] Search and filter narrow the visible results
- [ ] Video plays on click

---

### Task 7.4 — Implement Video Player Component
**Owner:** A | **Depends on:** Task 7.3

- [ ] Create `<VideoPlayer>` component using HTML5 `<video>` tag
- [ ] Props: `src` (video URL), `onClose` callback
- [ ] Controls: play/pause, seek bar, volume, fullscreen
- [ ] Close button dismisses the player
- [ ] Fallback message if video fails to load

Acceptance Criteria:
- [ ] Video plays and pauses correctly
- [ ] Close button works
- [ ] No autoplay without user interaction

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

---

### Task 7.7 — Test Video Playback Compatibility
**Owner:** C | **Depends on:** Task 7.4

- [ ] Test `.mp4` playback in Chrome — pass/fail
- [ ] Test `.mp4` playback in Firefox — pass/fail
- [ ] Test `.webm` playback in Chrome — pass/fail
- [ ] Test playback at different video file sizes (small, medium, large)
- [ ] Document results in `docs/testing_log.md`

Acceptance Criteria:
- [ ] At least `.mp4` plays in Chrome and Firefox
- [ ] Results documented

---

## Week 8 — Quiz Module Development
**Members:** B, C | **Deliverable:** Self-assessment system

---

### Task 8.1 — Design Quiz Data Structure
**Owner:** C | **Depends on:** Task 1.3

- [ ] Confirm `quizzes`, `questions`, and `quiz_attempts` table schemas (from Task 1.3)
- [ ] Add any missing fields: options stored as JSON array vs separate columns
- [ ] Decision: store options as `option_a`, `option_b`, `option_c`, `option_d` columns
- [ ] Document final schema in `docs/database_schema.md`

Acceptance Criteria:
- [ ] Schema finalised and documented before any quiz API is built

---

### Task 8.2 — Build Quiz Management APIs (Teacher)
**Owner:** B | **Depends on:** Task 8.1

- [ ] `POST /api/quizzes` — create quiz: title, description
- [ ] `GET /api/quizzes` — list all quizzes (teacher: all, student: published only)
- [ ] `GET /api/quizzes/:id` — get quiz with questions
- [ ] `PUT /api/quizzes/:id` — update quiz metadata
- [ ] `DELETE /api/quizzes/:id` — delete quiz
- [ ] `POST /api/quizzes/:id/questions` — add question with options and correct answer
- [ ] `PUT /api/questions/:id` — update question
- [ ] `DELETE /api/questions/:id` — delete question

Acceptance Criteria:
- [ ] Full CRUD for quizzes and questions
- [ ] Correct answer stored but not exposed in student-facing API response

---

### Task 8.3 — Build Quiz Creation UI (Teacher)
**Owner:** C | **Depends on:** Task 8.2

In `src/pages/Quizzes.tsx` (teacher view):
- [ ] `Create Quiz` button opens a form: title, description fields
- [ ] After creating a quiz, show a question editor
- [ ] Add Question form: question text, 4 options (A–D), correct answer selector
- [ ] Save question calls `POST /api/quizzes/:id/questions`
- [ ] Questions listed below with edit and delete buttons

Acceptance Criteria:
- [ ] Teacher can create a quiz with multiple questions
- [ ] Questions saved to the backend

---

### Task 8.4 — Build Quiz List View (Student and Teacher)
**Owner:** C | **Depends on:** Task 8.2

In `src/pages/Quizzes.tsx`:
- [ ] Fetch quiz list on load
- [ ] Each row: quiz title, number of questions, status (completed/pending), type badge
- [ ] Student and teacher quiz row actions follow `design.md` section 9

Acceptance Criteria:
- [ ] Quiz list renders from API
- [ ] Student and teacher views differ correctly

---

### Task 8.5 — Build Quiz Attempt Flow (Student)
**Owner:** C | **Depends on:** Task 8.4

- [ ] Clicking `Start Quiz` loads the quiz questions
- [ ] One question displayed at a time with 4 radio button options
- [ ] `Next` button advances to next question
- [ ] After last question, `Submit` button sends all answers

Acceptance Criteria:
- [ ] Student can navigate through all questions
- [ ] Answers are collected before submission

---

### Task 8.6 — Build Quiz Scoring API
**Owner:** B | **Depends on:** Task 8.2

- [ ] `POST /api/quizzes/:id/submit` — accepts `{ answers: { question_id, selected_option }[] }`
- [ ] Compare each answer against stored correct answer
- [ ] Calculate score as percentage
- [ ] Store attempt in `quiz_attempts` table: quiz_id, student_id, score, attempted_at
- [ ] Return `{ score, total, correct, incorrect, feedback: [...] }` — feedback shows correct answer per question

Acceptance Criteria:
- [ ] Score calculated correctly
- [ ] Attempt stored with student ID and timestamp
- [ ] Feedback returned per question

---

### Task 8.7 — Display Quiz Results (Student)
**Owner:** C | **Depends on:** Task 8.6

After submitting:
- [ ] Show overall score: e.g. `You scored 7 / 10 (70%)`
- [ ] Show per-question feedback: student's answer vs correct answer
- [ ] Correct answers marked green, incorrect marked red
- [ ] `Retry` button resets and restarts the quiz
- [ ] `Back to Quizzes` button returns to list

Acceptance Criteria:
- [ ] Score and feedback display from API response
- [ ] Retry restarts the question flow

---

### Task 8.8 — Build Quiz History (Student)
**Owner:** B | **Depends on:** Task 8.6

- [ ] `GET /api/students/me/attempts` — returns all quiz attempts for the logged-in student
- [ ] Each attempt: quiz title, score, date
- [ ] Display attempt history on the student Quiz list (below the quiz row or in an expandable section)

Acceptance Criteria:
- [ ] Student can see their past scores per quiz
- [ ] Most recent attempt shown on quiz list row

---

## Week 9 — Authentication & Role Management
**Members:** B, D | **Deliverable:** User authentication and RBAC

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

---

### Task 9.6 — Protect Frontend Routes
**Owner:** D | **Depends on:** Task 9.4

- [ ] Create `ProtectedRoute` component: checks for JWT in `sessionStorage`, redirects to `/login` if missing
- [ ] Wrap all app routes (Dashboard, Viewer, Videos, Quizzes, Library) in `ProtectedRoute`
- [ ] `/login` and `/register` remain unprotected

Acceptance Criteria:
- [ ] Unauthenticated user redirected to `/login` on any protected route
- [ ] Authenticated user can access all pages

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
- [ ] 3D viewer with model loading, orbit controls, raycasting
- [ ] Anatomical labelling (create, view, click, hover)
- [ ] Educational video browsing and playback
- [ ] Video linked to label in viewer detail panel
- [ ] Quiz creation (teacher) and quiz attempt + scoring (student)
- [ ] Model and video upload with format validation
- [ ] JWT authentication and role-based access control
- [ ] Model download in original format
- [ ] Label export in JSON and CSV

### Should Have
- [ ] Content visibility (publish/unpublish toggle)
- [ ] Quiz attempt history for students
- [ ] Video-to-label linking UI
- [ ] Storage abstraction layer (cloud-ready)
- [ ] Browser compatibility confirmed (Chrome + Firefox)

### Could Have
- [ ] Actual cloud storage (S3 or equivalent)
- [ ] Video thumbnail generation
- [ ] Quiz timer
- [ ] Student progress dashboard with charts
