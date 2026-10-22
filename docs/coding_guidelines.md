# coding_guidelines.md — AnatoLearn Clean Code Guidelines

## 1. Core Principle

Write code that allows new pages, role-gated features, program filters, and content types to be added without editing shared systems.

If adding a new role check requires touching more than one file, the role logic is probably in the wrong place.

---

## 2. TypeScript Style

### Naming

Use PascalCase for:
- Component names
- Types and interfaces
- Enums

Use camelCase for:
- Variables
- Function names
- Props
- State values

Use `SCREAMING_SNAKE_CASE` for:
- Constants defined outside components

Example:
```tsx
const ANATOMY_PARTS: AnatomyPart[] = [...];

const [selectedPart, setSelectedPart] = useState<AnatomyPart | null>(null);

function Viewer() { ... }
```

---

## 3. Component Rules

### Good Component Responsibilities
- Render UI based on props and context
- Own local UI state (open/closed, selected item)
- Forward user intent to handlers (onClick, onChange)

### Bad Component Responsibilities
- Directly modifying shared context from deep inside a component tree
- Hardcoding role logic inside a shared component
- Containing Three.js scene logic outside of Viewer

---

## 4. Context Rules

`AppContext` is the single source of truth for role and program after they are decoded from the authenticated user's JWT.

Good:
```tsx
const { role, program } = useAppContext();
```

Bad:
```tsx
// Reading role from URL path
const isTeacher = window.location.pathname.includes('teacher');
```

Do not create multiple contexts for the same concern. All global role/program state lives in one context.

---

## 5. Role-Gating Rules

On shared pages, role checks happen at the JSX render level — not in routing, not in context, not in data fetching. Role route guards are allowed only for pages or workflows that are exclusively student-only or teacher-only. Auth guards belong in `ProtectedRoute`.

Good:
```tsx
{role === 'teacher' && <button>Upload Video</button>}
```

Bad:
```tsx
// Do not gate shared routes by role
// Do not use role to derive component behavior outside JSX conditionals
```

Student-only and teacher-only UI on shared pages must be siblings in the same component, not in separate route paths.

---

## 6. Three.js Rules

Three.js must live entirely inside `Viewer.tsx`.

### Do
- Store scene, camera, renderer, controls, and meshes in refs
- Set up everything inside a `useEffect`
- Return a cleanup function that disposes all resources
- Add resize listener inside the effect; remove it in cleanup
- Add click listener to mount element; remove it in cleanup

### Do Not
- Store `THREE.Mesh` or `THREE.Scene` in React state
- Call `setState` inside the animation loop
- Create `new THREE.WebGLRenderer()` outside a `useEffect`
- Leave dangling animation frames or event listeners

---

## 7. State Placement Rules

| State | Where |
|---|---|
| Role | `AppContext` |
| Program | `AppContext` |
| Selected anatomy part | `Viewer.tsx` local state |
| Is adding label | `Viewer.tsx` local state |
| Show video player | `Viewer.tsx` local state |
| Labels list | `Viewer.tsx` local state |
| Video search query | `Videos.tsx` local state |
| Quiz filter | `Quizzes.tsx` local state |

Do not lift state up unless two sibling components need the same value.
Do not put page-local state into context.

---

## 8. Avoid Magic Strings

Use typed enums or union types for role, program, and card types.

Bad:
```tsx
if (role === 'teacher') // fine only if role is typed
if (program === 'Physio') // wrong: not in Program type
```

Good:
```tsx
type Program = 'PT' | 'OT' | 'Radiography' | 'Nursing';
if (program === 'PT')
```

For anatomy part IDs and other identifiers, use stable string constants from data arrays.

---

## 9. Three.js Cleanup Requirement

Every `useEffect` that sets up Three.js must return a complete cleanup function.

Minimum required cleanup:
```tsx
return () => {
  window.removeEventListener('resize', handleResize);
  if (mountRef.current) {
    mountRef.current.removeEventListener('click', onMouseClick);
    if (rendererRef.current?.domElement) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }
  }
  meshesRef.current.forEach((mesh) => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
  bodyGeo.dispose();
  bodyMat.dispose();
  renderer.dispose();
};
```

---

## 10. Import Rules

OrbitControls must use the addons path:
```tsx
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

Not:
```tsx
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; // legacy
```

---

## 11. Tailwind Class Rules

- Do not write custom CSS unless a Tailwind class does not exist for the need
- Do not use inline `style={{}}` for values that have Tailwind equivalents
- Use `transition-colors` and `transition-shadow` for hover effects, not JS
- Use responsive prefixes (`sm:`, `md:`, `lg:`) rather than JS breakpoint checks
- Group related classes logically: layout → spacing → colors → typography → interactions

---

## 12. Prop Types and Interfaces

All component props must be typed.

```tsx
interface CardViewProps {
  title: string;
  subtitle: string;
  href: string;
  gradient: string;
  icon: React.ReactNode;
}
```

Do not use `any`. Use `unknown` and narrow it if needed.

---

## 13. Error Handling

### Missing Art / Images
All images must have an `alt` attribute.
If a dynamic image URL may be missing, provide a fallback `src` or conditional render.

### Missing Three.js Mount
Guard all Three.js operations with null checks:
```tsx
if (!mountRef.current) return;
```

### Missing Context
`useAppContext()` throws if used outside `AppProvider`. This is intentional — never use the context hook outside the provider tree.

---

## 14. Performance Rules

- Do not call `renderer.render()` outside the animation loop
- Do not create new geometries or materials on every render
- Do not use `document.getElementById` or `document.querySelector` — use refs
- Avoid `useEffect` dependencies that change every render (object literals, inline functions)

---

## 15. File Organization Rules

One component per file. File name matches the exported component name.

```
Dashboard.tsx   → export function Dashboard()
Viewer.tsx      → export function Viewer()
Layout.tsx      → export function Layout()
AppContext.tsx   → export function AppProvider() + export function useAppContext()
```

---

## 16. Definition of Clean Implementation

A clean implementation means:
- New programs can be added by editing the selector options and the `Program` type only
- New nav items can be added by editing the `navItems` array only
- All role-gated UI is controlled only through the `role` context value
- The Three.js scene is fully torn down when Viewer unmounts
- No page imports from another page
- No context values are modified from inside shared UI components

---

## 17. Engineering Contract Relocated from Agents.md

The following sections preserve the engineering instructions previously held in `Agents.md`. Product behavior and acceptance criteria belong in `PRD.md`; agent operation belongs in `Agents.md`. These engineering constraints are prescriptive, whereas `Architecture.md` describes the implementation and its current deviations. Relocation does not mean those deviations have been fixed or that a technical-policy change has been approved.

When extending AppContext, review whether the proposed state is genuinely global; do not duplicate page-local state across contexts. Keep context, routing, layout and pages separated. Use the dependency boundaries described by topic in `Architecture.md` rather than relying on its former section numbers.

UI implementation continues to use Tailwind classes except where custom CSS is unavoidable, and icons are to be imported from lucide-react. The existing code's exceptions are recorded in `design.md`. Product hover/focus, image and responsive acceptance checks are in `PRD.md` section 13.

### Required Architecture Style

Follow the layered architecture defined in [`Architecture.md`](Architecture.md):

1. **Context Layer** — `AppContext.tsx` — role and program only
2. **Routing Layer** — `App.tsx` and `ProtectedRoute.tsx` — public auth routes plus protected app routes
3. **Layout Layer** — `Layout.tsx` — persistent nav shell
4. **Page Layer** — `Dashboard`, `Viewer`, `Videos`, `Quizzes`, `Library`
5. **Three.js Layer** — isolated inside `Viewer.tsx` useEffect

---

### Important Implementation Rules

#### Do
- Read `role` from `useAppContext()` — never from props, URLs, or local state
- Read `program` from `useAppContext()` — never duplicated in local state
- Store Three.js objects in refs — never in React state
- Use the `three/addons/controls/OrbitControls.js` import path
- Use Tailwind responsive prefixes for breakpoints — not JS checks
- Implement card hover behavior according to [`design.md`](design.md).
- Use `useLocation().pathname` for active nav link detection
- Guard all Three.js operations with null checks on refs and mountRef

#### Do Not
- Do not put role logic in route guards except for pages or workflows that are exclusively student-only or teacher-only
- Do not put role logic in context — only in JSX conditionals
- Do not call `setState` inside the Three.js animation loop
- Do not store `THREE.Mesh`, `THREE.Scene`, or renderer in React state
- Do not leave Three.js event listeners or animation frames on unmount
- Do not import from one page file inside another page file
- Do not use inline `style={{}}` for values that have Tailwind equivalents
- Do not use `any` type in TypeScript

---

### Development Order

Agents should implement in this order:

1. Project setup (Vite, Tailwind, dependencies)
2. `AppContext` (role + program state)
3. Auth flow (`Login.tsx`, `Register.tsx`, JWT decoding, `ProtectedRoute.tsx`)
4. `App.tsx` router
5. `Layout.tsx` (nav shell, role/program display and controls following [`design.md`](design.md))
6. `Dashboard.tsx` (student + teacher views)
7. `Videos.tsx`
8. `Quizzes.tsx`
9. `Library.tsx` (including materials and links)
10. `Viewer.tsx` (Three.js setup, raycasting, detail panel, cleanup)
11. Responsive check and role/program verification

---

### Naming Conventions

#### Files
- One component per file
- File name matches exported component name exactly

```
AppContext.tsx   → export function AppProvider, export function useAppContext
Layout.tsx       → export function Layout
ProtectedRoute.tsx → export function ProtectedRoute
Login.tsx        → export function Login
Register.tsx     → export function Register
Dashboard.tsx    → export function Dashboard
Viewer.tsx       → export function Viewer
Videos.tsx       → export function Videos
Quizzes.tsx      → export function Quizzes
Library.tsx      → export function Library
App.tsx          → export function App
```

#### Types and Interfaces
PascalCase:
- `Role`
- `Program`
- `AppContextType`
- `AnatomyPart`
- `NavItem`

#### Constants (outside components)
SCREAMING_SNAKE_CASE:
- `ANATOMY_PARTS`
- `DEFAULT_HAND_SIZE` (if needed)

#### State and Variables
camelCase:
- `selectedPart`
- `isAddingLabel`
- `showVideo`

---

### Expected Core Types

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


