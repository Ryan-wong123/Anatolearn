# tasks.md — AnatoLearn Implementation Task Breakdown

## Purpose
This file is the implementation checklist for AnatoLearn.

Use it with:
- `PRD.md` for product requirements and feature scope
- `Architecture.md` for system structure and Three.js rules
- `coding_guidelines.md` for code style and clean code rules
- `design.md` for UI layout, color, and component visual specs

## Task Status Key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked / needs decision

A task is done only when:
- Code compiles with no TypeScript errors
- Role-gated UI is controlled only through context
- Three.js resources are disposed on unmount (Viewer only)
- UI matches the design spec
- Feature works for both Student and Teacher roles
- Feature works across all four programs

---

## Milestone 0 — Project Setup

### Task 0.1 — Create Vite + React + TypeScript Project
**Status:** [ ]
- [ ] `npm create vite@latest anatolearn -- --template react-ts`
- [ ] Install dependencies: `react-router-dom`, `three`, `lucide-react`
- [ ] Install dev dependencies: `tailwindcss`, `postcss`, `autoprefixer`, `@types/three`
- [ ] Configure Tailwind in `tailwind.config.js` and `postcss.config.js`
- [ ] Add Tailwind imports to `src/index.css`
- [ ] Verify project runs with `npm run dev`

Acceptance Criteria:
- [ ] App opens in browser with no console errors
- [ ] Tailwind utility classes render correctly
- [ ] TypeScript strict mode enabled

---

### Task 0.2 — Create Folder Structure
**Status:** [ ]
- [ ] Create `src/context/`
- [ ] Create `src/components/`
- [ ] Create `src/pages/`

Acceptance Criteria:
- [ ] Folder structure matches `Architecture.md` section 3

---

## Milestone 1 — Global State and Routing

### Task 1.1 — Create AppContext
**Status:** [ ]

Create `src/context/AppContext.tsx`:
- [ ] Define `Role` type: `'student' | 'teacher'`
- [ ] Define `Program` type: `'PT' | 'OT' | 'Radiography' | 'Nursing'`
- [ ] Create `AppContextType` interface
- [ ] Implement `AppProvider` with `useState` for role and program
- [ ] Implement `useAppContext()` hook that throws if used outside provider

Acceptance Criteria:
- [ ] Context compiles with no TypeScript errors
- [ ] `useAppContext()` returns role, setRole, program, setProgram
- [ ] Default role is `'student'`, default program is `'PT'`

---

### Task 1.2 — Create App.tsx Router
**Status:** [ ]

Create `src/App.tsx`:
- [ ] Wrap in `<AppProvider>`
- [ ] Wrap in `<BrowserRouter>`
- [ ] Define `<Routes>` with `Layout` as parent and all 5 page routes as children

Routes:
- [ ] `/` → `Dashboard`
- [ ] `/viewer` → `Viewer`
- [ ] `/videos` → `Videos`
- [ ] `/quizzes` → `Quizzes`
- [ ] `/library` → `Library`

Acceptance Criteria:
- [ ] Navigating to each path renders the correct page
- [ ] Layout (nav) is always visible

---

## Milestone 2 — Layout and Navigation

### Task 2.1 — Create Layout Component
**Status:** [ ]

Create `src/components/Layout.tsx`:

**Outer shell:**
- [ ] `min-h-screen bg-slate-50 flex flex-col`

**Header:**
- [ ] Sticky, `h-16`, white background, `border-b border-slate-200`, `z-50`
- [ ] Max-width container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

**Logo:**
- [ ] 32×32px `bg-blue-600 rounded-lg` with placeholder icon
- [ ] Brand name `AnatoLearn` — `font-bold text-xl text-slate-900 tracking-tight`

**Nav links (desktop, `md:flex`):**
- [ ] Read `navItems` array: Dashboard, 3D Viewer, Videos, Quizzes, Library
- [ ] Active state: `bg-blue-50 text-blue-700`
- [ ] Inactive state: `text-slate-600 hover:bg-slate-100 hover:text-slate900`
- [ ] Active detection using `useLocation().pathname === item.path`

**Program switcher:**
- [ ] Label + `<select>` with 4 program options
- [ ] Calls `setProgram()` on change

**Role toggle:**
- [ ] `bg-slate-100 p-1 rounded-lg` pill container
- [ ] Student / Teacher buttons
- [ ] Active: `bg-white text-slate-900 shadow-sm`
- [ ] Calls `setRole()` on click

**User avatar:**
- [ ] `UserCircle2` ghost button

**Main outlet:**
- [ ] `<main className="flex-1 flex flex-col"><Outlet /></main>`

Acceptance Criteria:
- [ ] Nav renders on all pages
- [ ] Active nav link highlights correctly on route change
- [ ] Role toggle correctly updates `role` in context
- [ ] Program selector correctly updates `program` in context

---

## Milestone 3 — Dashboard Page

### Task 3.1 — Create Dashboard Component
**Status:** [ ]

Create `src/pages/Dashboard.tsx`:

**Header:**
- [ ] `Welcome back, [Student | Instructor]` heading
- [ ] `[Program] Program Overview` subheading

**Student stats grid:**
- [ ] 3-column responsive grid
- [ ] Study Time card (`Clock`, blue) — `12.5h`
- [ ] Quiz Average card (`Trophy`, yellow) — `85%`
- [ ] Models Explored card (`Activity`, green) — `24`

**Student continue learning grid:**
- [ ] 3-column responsive grid
- [ ] Muscular System → `/viewer` (blue gradient)
- [ ] Cardiovascular Basics → `/videos` (purple gradient)
- [ ] Respiratory Quiz → `/quizzes` (green gradient)
- [ ] Each card: gradient header with scaling icon, title, subtitle

**Teacher stats grid:**
- [ ] Models Uploaded (`12`), Videos Linked (`45`), Student Engagement (`High`)

**Teacher quick actions grid:**
- [ ] 4-column responsive grid
- [ ] Upload New Model → `/library`
- [ ] Manage Labels → `/viewer`
- [ ] Add Educational Video → `/videos`
- [ ] Create Quiz → `/quizzes`

Acceptance Criteria:
- [ ] Student and Teacher views render correctly based on `role`
- [ ] All links navigate to correct routes
- [ ] Program label shown in subheading matches selected program

---

## Milestone 4 — Videos Page

### Task 4.1 — Create Videos Component
**Status:** [ ]

Create `src/pages/Videos.tsx`:

**Header:**
- [ ] Title and subtitle
- [ ] Teacher only: `Upload Video` primary button with `Plus` icon

**Search + filter bar:**
- [ ] Search input with `Search` icon prefix
- [ ] Category `<select>`: All Systems, Muscular, Cardiovascular, Respiratory

**Video grid:**
- [ ] `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`
- [ ] Mock data: 3 videos (see PRD section 8)
- [ ] Each card: thumbnail with play overlay, duration badge, category label, title
- [ ] Teacher only: Edit + Link to Model buttons per card

Acceptance Criteria:
- [ ] 3 mock video cards render
- [ ] Upload button visible for teacher only
- [ ] Edit/link buttons visible for teacher only
- [ ] Play button overlay appears on hover (CSS group-hover)

---

## Milestone 5 — Quizzes Page

### Task 5.1 — Create Quizzes Component
**Status:** [ ]

Create `src/pages/Quizzes.tsx`:

**Header:**
- [ ] Title and subtitle
- [ ] Teacher only: `Create Quiz` button with `Plus` icon

**Quiz list:**
- [ ] White card with dividers
- [ ] Mock data: 3 quizzes (see PRD section 8)
- [ ] Each row: status icon + title + type badge
- [ ] Meta: question count + time limit
- [ ] Student completed: score display
- [ ] Student pending: `Start Quiz` link
- [ ] Teacher: Edit + View Results buttons

Acceptance Criteria:
- [ ] Completed quiz shows `CheckCircle` green icon and score
- [ ] Pending quiz shows `Clock` amber icon and Start button
- [ ] Create button visible for teacher only
- [ ] Edit/View Results visible for teacher only

---

## Milestone 6 — Library Page

### Task 6.1 — Create Library Component
**Status:** [ ]

Create `src/pages/Library.tsx`:

**Header:**
- [ ] Title and subtitle
- [ ] Teacher only: `Upload Content` button with `Upload` icon

**Teacher upload drop zone (teacher only):**
- [ ] Dashed border area with `Upload` icon, heading, and format note

**File list:**
- [ ] White card with dividers
- [ ] Mock data: 4 files (see PRD section 8)
- [ ] File icon by type: `FileBox` (model), `FileVideo` (video), `FileText` (data)
- [ ] File name + size + date
- [ ] Download button for all users
- [ ] Teacher only: `MoreVertical` options button

Acceptance Criteria:
- [ ] Upload drop zone visible for teacher only
- [ ] Upload button visible for teacher only
- [ ] Options button visible for teacher only
- [ ] File icons match file types

---

## Milestone 7 — 3D Viewer Page

### Task 7.1 — Create Viewer Component
**Status:** [ ]

Create `src/pages/Viewer.tsx`:

**Layout:**
- [ ] Full remaining viewport height: `h-[calc(100vh-64px)]`
- [ ] Two-panel flex: canvas (flex-1) + side panel (w-96)

**Three.js setup (inside useEffect):**
- [ ] Create Scene with background `#f8fafc`
- [ ] Create PerspectiveCamera (75°, z=5)
- [ ] Create WebGLRenderer (antialias), append to mountRef
- [ ] Create OrbitControls (damping 0.05)
- [ ] Add AmbientLight (0.6) and DirectionalLight (0.8)
- [ ] Create body placeholder (CylinderGeometry, semi-transparent)
- [ ] Create anatomy meshes from `ANATOMY_PARTS` constant
- [ ] Start animation loop with `requestAnimationFrame`
- [ ] Add window resize handler (updates camera aspect + renderer size)
- [ ] Add click handler (raycasting against meshesRef)

**Three.js cleanup (useEffect return):**
- [ ] Remove resize listener
- [ ] Remove click listener
- [ ] Remove renderer DOM element from mountRef
- [ ] Dispose all mesh geometries and materials
- [ ] Dispose body geometry and material
- [ ] Call renderer.dispose()

**Viewer toolbar (top-left overlay):**
- [ ] Reset View (`RotateCcw`) — resets camera to origin
- [ ] Zoom In (`ZoomIn`)
- [ ] Zoom Out (`ZoomOut`)
- [ ] Pan (`Move`)

**System selector (top-right overlay):**
- [ ] `<select>` with 4 system options

**Teacher controls (bottom-left, teacher only):**
- [ ] Add Label toggle button (blue default, amber when active)
- [ ] Instruction text badge when active

**Side panel — empty state:**
- [ ] `Move` icon in slate circle
- [ ] "Select a structure" heading + description

**Side panel — part selected:**
- [ ] Part name heading
- [ ] Close X (mobile only)
- [ ] Program badge
- [ ] Description section
- [ ] Video thumbnail with play overlay → click shows video player
- [ ] Video player with close X
- [ ] Teacher controls: Edit Description + Change Linked Video buttons

**Panel animation:**
- [ ] Selected: `translate-x-0`
- [ ] Empty: `translate-x-full md:translate-x-0 hidden md:flex`

Acceptance Criteria:
- [ ] 3D meshes render in canvas
- [ ] Clicking a mesh selects it and opens detail panel
- [ ] Clicking empty space deselects
- [ ] Reset View restores camera position
- [ ] Video thumbnail click shows player, X closes it
- [ ] Teacher controls visible only for teacher role
- [ ] All Three.js resources disposed on unmount (verify no console errors on route change)
- [ ] Canvas resizes correctly on browser resize

---

## Milestone 8 — Polish and Validation

### Task 8.1 — Responsive Check
**Status:** [ ]
- [ ] Test all pages at mobile width (<768px)
- [ ] Test all pages at tablet width (768px–1024px)
- [ ] Test all pages at desktop width (>1024px)
- [ ] Nav links hidden on mobile, visible on md+
- [ ] Viewer panel collapses correctly on mobile

### Task 8.2 — Role Switching Test
**Status:** [ ]
- [ ] Switch role on each page and verify correct UI shown
- [ ] No teacher-only UI visible in student mode
- [ ] No console errors on role switch

### Task 8.3 — Program Switching Test
**Status:** [ ]
- [ ] Switch program on Dashboard and verify subheading updates
- [ ] Switch program on Viewer panel and verify badge updates
- [ ] No console errors on program switch

### Task 8.4 — Three.js Cleanup Test
**Status:** [ ]
- [ ] Navigate to Viewer, then navigate away
- [ ] Verify no "Cannot read properties of null" or "WebGL context lost" errors
- [ ] Navigate back to Viewer and verify 3D scene renders again

### Task 8.5 — Missing Art / Placeholder Check
**Status:** [ ]
- [ ] All images have `alt` attributes
- [ ] No broken image icons visible anywhere in the UI

---

## Priority Summary

### Must Have
- [ ] AppContext with role and program
- [ ] Layout with sticky nav, role toggle, program selector
- [ ] Dashboard with student/teacher views
- [ ] Videos page with grid and role-gated upload button
- [ ] Quizzes page with list and role-gated actions
- [ ] Library page with file list and role-gated upload zone
- [ ] Viewer with Three.js scene, raycasting, and detail panel

### Should Have
- [ ] Viewer teacher controls (Add Label, Edit Description)
- [ ] Video search and category filter (functional)
- [ ] Responsive layout at all breakpoints
- [ ] Three.js full cleanup on unmount

### Could Have
- [ ] Real video playback (embedded player)
- [ ] Working quiz flow (question → answer → score)
- [ ] Library file upload (connected to backend)
- [ ] Real 3D model loading (GLTFLoader)
- [ ] Animations on meter/stat change
