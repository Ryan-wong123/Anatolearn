# Architecture.md — AnatoLearn Technical Architecture

## 1. Architecture Goals

The AnatoLearn codebase must be:
- Maintainable and easy to extend
- Clean separation between data, state, logic, and UI
- Role and program logic controlled exclusively via shared context — never hardcoded per page
- Three.js scene lifecycle managed correctly (setup, resize, cleanup)

---

## 2. High-Level Architecture

```
AppContext (role, program)
        ↓
React Router (Layout shell + page routes)
        ↓
Page Components (Dashboard, Viewer, Videos, Quizzes, Library)
        ↓
Shared UI Components (CardView, MeterRow, etc.)
        ↓
Three.js Scene (Viewer only — isolated in useEffect)
```

### Layer Responsibilities

| Layer | Responsibility |
|---|---|
| Context | Global role + program state; single source of truth |
| Router | URL-to-page mapping; persistent Layout wrapper |
| Pages | Page-specific layout, data, and conditional role UI |
| Components | Reusable, stateless UI elements |
| Three.js | 3D scene inside Viewer — isolated, cleaned up on unmount |

---

## 3. Project Structure

```
src/
├── context/
│   └── AppContext.tsx        # Role + Program global state (React Context)
├── components/
│   └── Layout.tsx            # Sticky nav shell + <Outlet />
├── pages/
│   ├── Dashboard.tsx         # Stats + quick-access cards
│   ├── Viewer.tsx            # Three.js 3D viewer + detail panel
│   ├── Videos.tsx            # Video grid + search + filter
│   ├── Quizzes.tsx           # Quiz list with status tracking
│   └── Library.tsx           # File list + teacher upload zone
├── App.tsx                   # BrowserRouter + Routes
├── index.tsx                 # React root mount
└── index.css                 # Tailwind imports
```

---

## 4. Dependency Direction

```
Pages → Context (read role/program)
Pages → Components (render UI)
Layout → Context (render nav controls)
Viewer → Three.js (isolated, no shared state leak)
```

**Rules:**
- Context must not import from pages or components
- Pages must not reach across to other pages
- Three.js logic must not leak outside the `Viewer` component

---

## 5. Global State — AppContext

```tsx
type Role = 'student' | 'teacher';
type Program = 'PT' | 'OT' | 'Radiography' | 'Nursing';

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  program: Program;
  setProgram: (program: Program) => void;
}
```

- Provided by `AppProvider` wrapping the entire `<BrowserRouter>` tree
- Consumed by `useAppContext()` hook on any page or component
- All role-gated UI reads only from `role`; never from URL, component name, or any other signal

---

## 6. Routing

```tsx
<AppProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="viewer" element={<Viewer />} />
        <Route path="videos" element={<Videos />} />
        <Route path="quizzes" element={<Quizzes />} />
        <Route path="library" element={<Library />} />
      </Route>
    </Routes>
  </BrowserRouter>
</AppProvider>
```

- `Layout` renders the persistent top navigation and `<Outlet />`
- All pages are children of `Layout` and share the nav shell
- Active nav link is determined by `useLocation().pathname` comparison

---

## 7. Three.js Architecture (Viewer Page)

The 3D viewer is entirely isolated inside a `useEffect` in `Viewer.tsx`.

### Refs (never stored in React state)
```tsx
const mountRef = useRef<HTMLDivElement>(null);
const sceneRef = useRef<THREE.Scene | null>(null);
const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
const controlsRef = useRef<OrbitControls | null>(null);
const meshesRef = useRef<THREE.Mesh[]>([]);
```

### Setup (inside useEffect)
1. Create Scene — background `#f8fafc`
2. Create PerspectiveCamera (75° FOV, z=5)
3. Create WebGLRenderer (antialias) — append to `mountRef`
4. Create OrbitControls (damping enabled, factor 0.05)
5. Add AmbientLight (0.6) + DirectionalLight (0.8, pos 10,20,10)
6. Create anatomy meshes (SphereGeometry r=0.5) from labels data
7. Create body placeholder (CylinderGeometry, semi-transparent)
8. Attach click listener for raycasting
9. Start animation loop

### Cleanup (useEffect return)
- Remove window resize listener
- Remove click listener from mount element
- Remove renderer DOM element from mount
- Dispose all mesh geometries and materials
- Dispose body geometry and material
- Call `renderer.dispose()`

### Resize Handler
```tsx
const handleResize = () => {
  camera.aspect = mount.clientWidth / mount.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(mount.clientWidth, mount.clientHeight);
};
window.addEventListener('resize', handleResize);
```

### Raycasting (click → selection)
- Use `THREE.Raycaster` to intersect `meshesRef.current`
- On hit: set `selectedPart` state, highlight mesh emissive to `0x444444`
- On miss (not adding label): clear selection, reset all emissives

### State managed in React (not refs)
```tsx
const [selectedPart, setSelectedPart] = useState<AnatomyPart | null>(null);
const [isAddingLabel, setIsAddingLabel] = useState(false);
const [labels, setLabels] = useState(ANATOMY_PARTS);
const [showVideo, setShowVideo] = useState(false);
```

---

## 8. Role-Gated Rendering Pattern

Role checks belong in JSX only — never in route guards or context logic.

```tsx
// Correct pattern
{role === 'teacher' && <button>Upload Video</button>}

// Ternary for mutually exclusive views
{role === 'student' ? <StudentStats /> : <TeacherStats />}
```

---

## 9. Anatomy Parts Data Model

```tsx
interface AnatomyPart {
  id: string;
  name: string;
  description: string;
  videoUrl: string;
  color: number;       // THREE.js hex color
  position: [number, number, number];
}
```

Stored as a constant in `Viewer.tsx` for prototype. In production this would be fetched from an API or CMS by program.

---

## 10. Viewer Import Note

OrbitControls must be imported from the addons path:
```tsx
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```
Not the legacy `three/examples/` path.

---

## 11. Data Flow — Video Play Example

```
User clicks video card thumbnail
        ↓
setShowVideo(true) in Videos.tsx
        ↓
Conditional render swaps thumbnail → video player
        ↓
User clicks X → setShowVideo(false) → thumbnail restored
```

No external state needed; video play state is local to each page.

---

## 12. Performance Guidelines

- Avoid `FindObjectOfType` equivalents (no `document.querySelector` in logic)
- Three.js animation loop must use `requestAnimationFrame` — never `setInterval`
- Do not call `setInterval` or start animation loops in React render body
- Refresh UI only when state changes — no polling
- Three.js resize and click listeners must be removed on cleanup

---

## 13. Extensibility Notes

| Change | What to edit |
|---|---|
| Add new program | Add `<option>` in Layout selector; add to `Program` type |
| Add new nav item | Add entry to `navItems` array in `Layout.tsx` |
| Add new video category | Add `<option>` in Videos filter dropdown |
| Add new quiz type | Add badge color entry in Quizzes type mapping |
| Add new library file type | Add `case` in `getIcon()` in Library |
| Add new anatomy part | Add entry to `ANATOMY_PARTS` in Viewer |
| Swap mock data for API | Replace constants with `useEffect` + `fetch` calls per page |

---

## 14. Dependencies

```json
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "three": "latest",
  "lucide-react": "latest",
  "typescript": "^5",
  "tailwindcss": "^3",
  "vite": "^5",
  "postcss": "latest",
  "autoprefixer": "latest"
}
```
