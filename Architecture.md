# Architecture.md - AnatoLearn Technical Architecture

## 1. Architecture Goals

The AnatoLearn codebase must be:
- Maintainable and easy to extend
- Cleanly separated between data, state, logic, and UI
- Driven by authenticated user context: `role` and `program` come from the decoded JWT
- Protected by auth guards on every app page
- Role-gated only for pages or workflows that are student-only or teacher-only
- Aligned with `design.md` for all UI layout, color, spacing, typography, and component visuals
- Safe for Three.js scene lifecycle management: setup, resize, animation, raycasting, and cleanup

---

## 2. High-Level Architecture

```
JWT authentication
        ↓
AppContext (role, program)
        ↓
React Router (public auth routes + protected app routes)
        ↓
Layout shell
        ↓
Page Components (Dashboard, Viewer, Videos, Quizzes, Library)
        ↓
Shared UI Components
        ↓
Three.js Scene (Viewer only, isolated in useEffect)
```

### Layer Responsibilities

| Layer | Responsibility |
|---|---|
| Auth | Login, registration, JWT storage, logout, and protected-route access |
| Context | JWT-derived role + program state; single source of truth for rendering |
| Router | URL-to-page mapping, public auth routes, and protected app routes |
| Layout | Persistent app shell for authenticated pages; visual details follow `design.md` |
| Pages | Page data, local state, and JSX conditionals for role-specific controls |
| Components | Reusable, typed UI building blocks; visual details follow `design.md` |
| Three.js | 3D scene inside `Viewer.tsx`, isolated and cleaned up on unmount |

---

## 3. Project Structure

```
src/
├── context/
│   └── AppContext.tsx        # JWT-derived role + program global state
├── components/
│   ├── Layout.tsx            # Persistent nav shell + <Outlet />
│   └── ProtectedRoute.tsx    # Auth guard for protected app pages
├── pages/
│   ├── Login.tsx             # Public login page; UI follows design.md
│   ├── Register.tsx          # Public registration page; UI follows design.md
│   ├── Dashboard.tsx         # Dashboard page; UI follows design.md
│   ├── Viewer.tsx            # 3D viewer page; UI follows design.md
│   ├── Videos.tsx            # Videos page; UI follows design.md
│   ├── Quizzes.tsx           # Quizzes page; UI follows design.md
│   └── Library.tsx           # Library, materials, and links page; UI follows design.md
├── App.tsx                   # BrowserRouter + Routes
├── index.tsx                 # React root mount
└── index.css                 # Tailwind imports
```

---

## 4. Dependency Direction

```
Auth services -> AppContext (set role/program from JWT)
Pages -> Context (read role/program)
Pages -> Components (render UI)
Layout -> Context (render app controls)
Viewer -> Three.js (isolated, no shared scene state)
```

**Rules:**
- Context must not import from pages or components
- Pages must not import from other page files
- Shared components must not hardcode role-specific behavior
- Three.js logic must not leak outside `Viewer.tsx`
- UI layout and visual specifications must be read from `design.md`

---

## 5. Global State - AppContext

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

- `role` and `program` are decoded from the authenticated user's JWT after login
- `AppProvider` wraps the entire `<BrowserRouter>` tree
- `useAppContext()` is consumed by pages and layout components
- All role-specific UI reads only from the context `role`
- Route authentication is handled by `ProtectedRoute`
- Role guards are used only for pages or workflows that are exclusively student-only or teacher-only

---

## 6. Routing

```tsx
<AppProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/3dviewer" element={<Viewer />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/library" element={<Library />} />
        </Route>
      </Route>
    </Routes>
  </BrowserRouter>
</AppProvider>
```

- `Login` and `Register` are public routes outside `Layout`
- `ProtectedRoute` redirects unauthenticated users to `/login`
- All app pages are children of `Layout`
- Active nav link is determined by `useLocation().pathname`

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

1. Guard with `if (!mountRef.current) return`
2. Create `THREE.Scene`; visual background follows `design.md`
3. Create `THREE.PerspectiveCamera`
4. Create `THREE.WebGLRenderer`, then append it to `mountRef.current`
5. Create `OrbitControls`
6. Add lighting
7. Load or create anatomy model and label meshes
8. Attach click listener for raycasting
9. Attach window resize listener
10. Start the `requestAnimationFrame` animation loop

### Cleanup (useEffect return)

- Cancel the animation frame
- Remove window resize listener
- Remove click listener from the mount element
- Remove renderer DOM element from the mount element
- Dispose all geometries
- Dispose all materials
- Dispose controls if available
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

### Raycasting (click -> selection)

- Use `THREE.Raycaster` to intersect `meshesRef.current`
- Calculate mouse coordinates relative to the mount element
- On hit: set `selectedPart` state and highlight the selected mesh
- On miss while not adding a label: clear selection and reset highlights

### State Managed In React

```tsx
const [selectedPart, setSelectedPart] = useState<AnatomyPart | null>(null);
const [isAddingLabel, setIsAddingLabel] = useState(false);
const [labels, setLabels] = useState<AnatomyPart[]>([]);
const [showVideo, setShowVideo] = useState(false);
```

---

## 8. Role-Gated Rendering Pattern

Role checks for shared pages belong in JSX conditionals. Auth checks belong in `ProtectedRoute`. Role route guards are only for pages or workflows that are exclusively student-only or teacher-only.

```tsx
{role === 'teacher' && <TeacherControls />}
{role === 'student' ? <StudentSummary /> : <TeacherSummary />}
```

---

## 9. Anatomy Parts Data Model

```tsx
interface AnatomyPart {
  id: string;
  name: string;
  description: string;
  videoUrl: string;
  color: number;
  position: [number, number, number];
}
```

In the full MVP, anatomy parts and labels are fetched from the backend. Temporary constants may be used only as mock fallback data during early development.

---

## 10. Viewer Import Note

OrbitControls must be imported from the addons path:

```tsx
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

Not the legacy `three/examples/` path.

---

## 11. Data Flow - Video Play Example

```
User clicks video card or linked label video
        ↓
Local page state opens the video player
        ↓
User closes player
        ↓
Local state restores the previous view
```

No global state is needed for video play state.

---

## 12. Dashboard Summary Flow

The dashboard remains a page-layer composition and retrieves its data through `api.getDashboardSummary()`. The authenticated backend endpoint derives quiz aggregates and recent attempts from the JWT user ID; it accepts no client-supplied student identifier. It also returns one rule-based featured published item. Unsupported video-watch and model-exploration metrics are represented as `null`, preserving a clear distinction between zero activity and unavailable tracking.

```
Dashboard -> authenticated API helper -> GET /api/dashboard/summary
                                      -> owned quiz attempts
                                      -> published featured content
```

---

## 13. Performance Guidelines

- Three.js animation loop must use `requestAnimationFrame`
- Do not call `setState` inside the Three.js animation loop
- Do not start animation loops in React render body
- Refresh UI only when state changes; no polling for UI state
- Three.js resize and click listeners must be removed on cleanup

---

## 14. Extensibility Notes

| Change | What to edit |
|---|---|
| Add new program | Add to `Program` type, backend validation, and Layout selector |
| Add new nav item | Add entry to `navItems` array in `Layout.tsx` |
| Add new video category | Add to backend/category data and Videos filter options |
| Add new quiz type | Add to quiz type mapping |
| Add new library file type | Add file type handling in `Library.tsx` |
| Add new anatomy part | Add backend data record or mock fallback entry |
| Swap mock data for API | Replace constants with authenticated API calls |

---

## 15. Dependencies

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
