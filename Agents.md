# Agents.md — Codex Workflow Instructions for AnatoLearn

## 1. Purpose

This file defines how Codex or coding agents should work on the AnatoLearn React project.

The goal is to implement a maintainable, extendible, and clean React web app for anatomy education, based on the design and architecture documents.

Agents must avoid hardcoded role logic, scene-global Three.js state, and per-page context duplication.

---

## 2. Prime Directive

Build the app using a **clean separation of concerns**:
- Global state (role, program) lives exclusively in `AppContext`
- Role-gated UI is rendered only through JSX conditionals — not through routing or context logic
- Three.js is isolated entirely inside `Viewer.tsx` — no scene objects leak outside

---

## 3. Required Architecture Style

Follow the layered architecture defined in `Architecture.md`:

1. **Context Layer** — `AppContext.tsx` — role and program only
2. **Routing Layer** — `App.tsx` — URL to component mapping
3. **Layout Layer** — `Layout.tsx` — persistent nav shell
4. **Page Layer** — `Dashboard`, `Viewer`, `Videos`, `Quizzes`, `Library`
5. **Three.js Layer** — isolated inside `Viewer.tsx` useEffect

---

## 4. Agent Responsibilities

### Product Agent
Responsible for:
- Ensuring all features match `PRD.md` scope
- Verifying role-gated features match the role-gating table in `PRD.md` section 6
- Checking that mock data matches `PRD.md` section 8
- Maintaining educational clarity of the platform's purpose

### Architecture Agent
Responsible for:
- Keeping context, routing, layout, and pages cleanly separated
- Preventing role logic from appearing outside JSX conditionals
- Preventing Three.js objects from leaking outside `Viewer.tsx`
- Reviewing that `AppContext` is only extended for genuinely global state
- Ensuring dependency direction follows `Architecture.md` section 4

### UI Agent
Responsible for:
- Implementing components exactly matching `design.md` visual specs
- Using only Tailwind CSS classes (no custom CSS unless unavoidable)
- Importing icons only from `lucide-react`
- Verifying responsive breakpoints match `design.md` section 13
- Ensuring all interactive elements have hover and focus states

### Three.js Agent
Responsible for:
- Implementing the Three.js scene only inside `Viewer.tsx`
- Ensuring all refs are typed correctly
- Implementing the full cleanup return function from `coding_guidelines.md` section 9
- Implementing resize handler correctly
- Implementing raycasting correctly (mouse coordinates, intersection check)

### QA Agent
Responsible for:
- Testing role toggle on every page
- Testing program selector updates visible text
- Testing Viewer navigation in and out (cleanup verification)
- Testing all mock data renders correctly
- Testing responsive layout at mobile, tablet, and desktop
- Checking all `alt` attributes on images

---

## 5. Important Implementation Rules

### Do
- Read `role` from `useAppContext()` — never from props, URLs, or local state
- Read `program` from `useAppContext()` — never duplicated in local state
- Store Three.js objects in refs — never in React state
- Use the `three/addons/controls/OrbitControls.js` import path
- Use Tailwind responsive prefixes for breakpoints — not JS checks
- Use `group` and `group-hover:` for card hover effects
- Use `useLocation().pathname` for active nav link detection
- Guard all Three.js operations with null checks on refs and mountRef

### Do Not
- Do not put role logic in route guards
- Do not put role logic in context — only in JSX conditionals
- Do not call `setState` inside the Three.js animation loop
- Do not store `THREE.Mesh`, `THREE.Scene`, or renderer in React state
- Do not leave Three.js event listeners or animation frames on unmount
- Do not import from one page file inside another page file
- Do not use inline `style={{}}` for values that have Tailwind equivalents
- Do not use `any` type in TypeScript

---

## 6. Development Order

Agents should implement in this order:

1. Project setup (Vite, Tailwind, dependencies)
2. `AppContext` (role + program state)
3. `App.tsx` router
4. `Layout.tsx` (nav shell, role toggle, program selector)
5. `Dashboard.tsx` (student + teacher views)
6. `Videos.tsx` (grid, search, filter)
7. `Quizzes.tsx` (list, status, role actions)
8. `Library.tsx` (file list, teacher upload zone)
9. `Viewer.tsx` (Three.js setup, raycasting, detail panel, cleanup)
10. Responsive check and role switch verification

---

## 7. Naming Conventions

### Files
- One component per file
- File name matches exported component name exactly

```
AppContext.tsx   → export function AppProvider, export function useAppContext
Layout.tsx       → export function Layout
Dashboard.tsx    → export function Dashboard
Viewer.tsx       → export function Viewer
Videos.tsx       → export function Videos
Quizzes.tsx      → export function Quizzes
Library.tsx      → export function Library
App.tsx          → export function App
```

### Types and Interfaces
PascalCase:
- `Role`
- `Program`
- `AppContextType`
- `AnatomyPart`
- `NavItem`

### Constants (outside components)
SCREAMING_SNAKE_CASE:
- `ANATOMY_PARTS`
- `DEFAULT_HAND_SIZE` (if needed)

### State and Variables
camelCase:
- `selectedPart`
- `isAddingLabel`
- `showVideo`

---

## 8. Expected Core Types

Agents should create or maintain:

```tsx
type Role = 'student' | 'teacher';
type Program = 'PT' | 'OT' | 'Radiography' | 'Nursing';

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  program: Program;
  setProgram: (program: Program) => void;
}

interface AnatomyPart {
  id: string;
  name: string;
  description: string;
  videoUrl: string;
  color: number;
  position: [number, number, number];
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}
```

---

## 9. Three.js Implementation Checklist

Before marking the Viewer task done, verify:

- [ ] Scene, camera, renderer, controls, and meshes stored in refs (not state)
- [ ] All created inside a single `useEffect`
- [ ] Resize handler added to `window` inside effect, removed in cleanup
- [ ] Click handler added to `mountRef.current` inside effect, removed in cleanup
- [ ] Renderer DOM element removed from `mountRef.current` in cleanup
- [ ] All geometries disposed in cleanup
- [ ] All materials disposed in cleanup
- [ ] `renderer.dispose()` called in cleanup
- [ ] `requestAnimationFrame` loop does not call `setState`
- [ ] `OrbitControls` imported from `three/addons/controls/OrbitControls.js`

---

## 10. Definition of Done

A task is done only when:
- TypeScript compiles with no errors
- All role-gated UI is controlled only through `role` from context
- Three.js scene is fully cleaned up on route change (Viewer task)
- UI matches `design.md` visual specification
- Feature works correctly for both `student` and `teacher` roles
- Feature works correctly across all four programs
- No console errors in the browser
