# design.md — AnatoLearn UI & Visual Design Specification

> **Image references** — every page section links to the wireframe screenshot it was derived from.
> All images live in `images/` relative to this file.
> Student view → `images/student<PageName>.png`
> Teacher view → `images/teacher<PageName>.png`

---

## 1. Design Philosophy

**Tone:** Clinical precision meets modern learning — clean, focused, and trustworthy. Medical-grade UI with cool slate tones as the base and a confident blue accent system. Structured without being sterile.

**Typography:**
- Display / Headings: `DM Sans` (bold, geometric warmth) — modern and approachable
- Body / UI labels: `IBM Plex Sans` (technical clarity) — legible and professional

---

## 2. Color System

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#F8FAFC` | Page background (slate-50) |
| `--color-surface` | `#FFFFFF` | Cards, panels |
| `--color-surface-muted` | `#F1F5F9` | Subtle secondary backgrounds |
| `--color-border` | `#E2E8F0` | Dividers, card edges |
| `--color-text-primary` | `#0F172A` | Headings, key content |
| `--color-text-secondary` | `#475569` | Body copy, labels |
| `--color-text-muted` | `#94A3B8` | Placeholders, disabled states |
| `--color-brand` | `#2563EB` | Primary actions, active nav, role toggle active text |
| `--color-brand-light` | `#EFF6FF` | Brand hover/active backgrounds |
| `--color-brand-hover` | `#1D4ED8` | Button hover |
| `--color-success` | `#10B981` | Completed states, CheckCircle icon |
| `--color-warning` | `#F59E0B` | Pending states, Clock icon |
| `--color-purple` | `#7C3AED` | Video category accents |

---

## 3. Typography Scale

| Role | Font | Weight | Size |
|---|---|---|---|
| Page heading | DM Sans | 700 | 30px (`text-3xl`) |
| Section heading | DM Sans | 600 | 18px (`text-lg`) |
| Card title | DM Sans | 600 | 16px (`text-base`) |
| Body | IBM Plex Sans | 400 | 14px (`text-sm`) |
| Label / badge | IBM Plex Sans | 500 | 12px (`text-xs`) |
| Stat value | DM Sans | 700 | 24px (`text-2xl`) |
| Nav link | IBM Plex Sans | 500 | 14px (`text-sm`) |

---

## 4. Global Layout Shell

```
┌──────────────────────────────────────────────────────────────────┐
│  TOP NAVIGATION BAR  (sticky, h-16, bg-white, border-b)          │
│  [Logo] [AnatoLearn]  [Nav Links...]   [PROGRAM ▾][Student|Teacher][👤] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MAIN CONTENT AREA  (flex-1, renders active page)                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Page background: `bg-slate-50 min-h-screen flex flex-col`.

---

## 5. Top Navigation Bar

> Visible in all 10 wireframes. Role toggle active state differs between student and teacher views.

**Height:** 64px (`h-16`), `bg-white`, `border-b border-slate-200`, `sticky top-0 z-50`.

### Left Side
- **Logo mark:** 32×32px `bg-blue-600 rounded-lg` with white `GraduationCap` icon inside
- **Brand name:** `AnatoLearn` — `font-bold text-xl text-slate-900 tracking-tight font-display`
- **Desktop nav links** (hidden on mobile, `md:flex space-x-1`):
  - Each link: `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors`
  - **Active state:** `bg-blue-50 text-blue-700` (matches active page in all wireframes)
  - **Inactive state:** `text-slate-600 hover:bg-slate-100 hover:text-slate-900`
  - Icons: `w-4 h-4`

| Nav Item | Icon | Path |
|---|---|---|
| Dashboard | `GraduationCap` | `/` |
| 3D Viewer | `Box` | `/viewer` |
| Videos | `Video` | `/videos` |
| Quizzes | `BookOpen` | `/quizzes` |
| Library | `Library` | `/library` |

### Right Side (left → right)
1. **Program label:** `text-xs font-medium text-slate-500 uppercase tracking-wider` — text `PROGRAM`
2. **Program `<select>`:** `pl-3 pr-8 py-1.5 text-sm border border-slate-300 rounded-md bg-white` — options: Physiotherapy, Occupational Therapy, Radiography, Nursing
3. **Role toggle** (no pill background, plain button pair):
   - **Student button:** active = `font-semibold text-slate-900`, inactive = `text-slate-400`
   - **Teacher button:** active = `font-semibold text-slate-900`, inactive = `text-slate-400`
   - From images: the active role label is bold/dark, inactive is muted — **no coloured pill background**, unlike the earlier implementation
4. **User avatar:** `UserCircle2` icon `w-8 h-8 text-slate-400`, ghost button

### Role Toggle — Visual Difference by Role

| State | Student active | Teacher active |
|---|---|---|
| Student button | Bold, `text-slate-900` | Muted, `text-slate-400` |
| Teacher button | Muted, `text-slate-400` | Bold, `text-slate-900` |

> **Images:** `images/studentDashboard.png` (Student selected), `images/teacherDashboard.png` (Teacher selected)

---

## 6. Page: Dashboard

### 6.1 Student Dashboard

> **Reference image:** `images/studentDashboard.png`

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

**Page header:**
- Heading: `text-3xl font-bold text-slate-900 font-display` — `Welcome back, Student`
- Subheading: `mt-1 text-slate-500 text-sm` — `PT Program Overview`

**Stat cards row** — 3-column responsive grid (`grid grid-cols-1 gap-5 sm:grid-cols-3`):

| Card | Icon | Icon colour | Value |
|---|---|---|---|
| Study Time | `Clock` | `text-blue-500` | `12.5h` |
| Quiz Average | `Trophy` | `text-yellow-500` | `85%` |
| Models Explored | `Activity` | `text-green-500` | `24` |

Card shell: `bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4`
- Icon: `w-6 h-6 flex-shrink-0`
- Label: `text-sm text-slate-500`
- Value: `text-2xl font-bold text-slate-900 font-display`

**"Continue Learning" section:**
- Section heading: `text-lg font-semibold text-slate-900 font-display mb-4` — `Continue Learning`
- Grid: `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`

| Card | Link | Gradient | Icon | Title | Subtitle |
|---|---|---|---|---|---|
| 1 | `/viewer` | `from-blue-50 to-indigo-100` | `Box` (blue) | `Muscular System` | `Resume 3D exploration` |
| 2 | `/videos` | `from-purple-50 to-pink-100` | `Video` (purple) | `Cardiovascular Basics` | `Next video in playlist` |
| 3 | `/quizzes` | `from-green-50 to-emerald-100` | `BookOpen` (green) | `Respiratory Quiz` | `Due in 2 days` |

Card: `group block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow`
- Image header `h-32`: gradient background + centered icon, icon scales on `group-hover:scale-110`
- Body `p-4`: title (`text-base font-semibold text-slate-900 font-display`) + subtitle (`text-sm text-slate-500 mt-0.5`)

---

### 6.2 Teacher Dashboard

> **Reference image:** `images/teacherDashboard.png`

**Page header:**
- Heading: `Welcome back, Instructor`
- Subheading: `PT Program Overview`

**Stat cards row** — same 3-column grid and card shell:

| Card | Icon | Icon colour | Value |
|---|---|---|---|
| Models Uploaded | `Box` | `text-blue-500` | `12` |
| Videos Linked | `Video` | `text-purple-500` | `45` |
| Student Engagement | `Activity` | `text-green-500` | `High` |

> Note from image: teacher stat cards have **no left icon** visible on Models Uploaded — it appears the icon is absent or very faint. Implement `Box` icon consistently with the student pattern.

**"Quick Actions" section:**
- Section heading: `text-lg font-semibold text-slate-900 font-display mb-4` — `Quick Actions`
- Grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
- 4 flat bordered buttons, text only, centred:

| Button label | Links to |
|---|---|
| Upload New Model | `/library` |
| Manage Labels | `/viewer` |
| Add Educational Video | `/videos` |
| Create Quiz | `/quizzes` |

Button: `flex items-center justify-center px-4 py-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors`

---

## 7. Page: 3D Viewer

### 7.1 Student 3D Viewer

> **Reference image:** `images/student3DViewer.png`

**Layout:** `flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden`
- **Canvas area:** `flex-1 relative bg-slate-50`
- **Side panel (right):** `w-80 bg-white border-l border-slate-200 flex flex-col` (narrower than 384px — approximately 320px based on image proportion)

**Viewer toolbar (left edge, vertical stack):**
`absolute top-4 left-4 z-10 flex flex-col gap-1 bg-white p-2 rounded-xl shadow-sm border border-slate-200`

Icon buttons top → bottom: `RotateCcw`, `ZoomIn`, `ZoomOut`, `Move`
- Each: `p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors w-9 h-9`

**System selector (top-right of canvas):**
`absolute top-4 right-4 zd-10` — white card with dropdown
- `bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2`
- `<select>`: `text-sm text-slate-700 bg-transparent focus:outline-none pr-6`
- Default: `Muscular System`

**Side panel — empty state (student, no structure selected):**
- Centred vertically: `flex-1 flex flex-col items-center justify-center p-6 text-center`
- Icon circle: `w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3`
- `Move` icon: `w-7 h-7 text-slate-400`
- Heading: `text-base font-semibold text-slate-800 font-display` — `Select a structure`
- Body: `text-sm text-slate-500 mt-1 max-w-[200px]` — `Click on any highlighted anatomical part in the 3D viewer to see its details and related videos.`

**No teacher controls visible for student role.**

---

### 7.2 Teacher 3D Viewer

> **Reference image:** `images/teacher3DViewer.png`

**All student viewer elements are present**, plus:

**Side panel — part selected (shown when a structure is clicked):**
- Part name: `text-2xl font-bold text-slate-900 font-display` — e.g. `Biceps Brachii`
- Program badge: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700` — `PT Module`
- Section label `DESCRIPTION`: `text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-1`
- Description body: `text-sm text-slate-600 leading-relaxed`
- Section label `EDUCATIONAL VIDEO`: `text-xs font-semibold text-slate-500 uppercase tracking-wider mt-5 mb-2`
- Video thumbnail: `w-full aspect-video rounded-lg overflow-hidden relative cursor-pointer border border-slate-200`
  - Full-bleed image with centred white play button circle (`w-10 h-10 bg-white/90 rounded-full flex items-center justify-center`)
  - `Play` icon: `w-4 h-4 text-blue-600 ml-0.5`
- Section label `TEACHER CONTROLS`: `text-xs font-semibold text-slate-500 uppercase tracking-wider mt-5 mb-2`
- `Edit Description` button: full-width secondary button
- `Change Linked Video` button: full-width secondary button

**Add Label button (bottom-left of canvas, teacher only):**
`absolute bottom-4 left-4 z-10`
- Default: `bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-blue-700`
- Label: `+ Add Label`
- Active state (label placement mode): `bg-amber-500 text-white` — label becomes `Cancel Labelling`

**Key difference from student view:**
- Student: side panel shows empty state only (no controls visible)
- Teacher: side panel shows full detail (part name, badge, description, video, teacher controls) when a structure is selected; Add Label button appears at canvas bottom-left

---

## 8. Page: Videos (Educational Videos)

### 8.1 Student Videos

> **Reference image:** `images/studentLearningVideos.png`

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

**Page header (no action button):**
- Heading: `text-3xl font-bold text-slate-900 font-display` — `Educational Videos`
- Subheading: `mt-1 text-sm text-slate-500` — `Bite-sized visual explanations of anatomical structures.`

**Search + filter bar** (`mt-6 mb-6 flex gap-3`):
- Search input: `relative flex-1 max-w-sm`, `Search` icon prefix `w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2`, input `pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white`
- Category `<select>`: `px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white`
- Default: `All Systems`

**Video grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

**Video card:** `bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer`
- Thumbnail: `w-full h-44 object-cover relative` — full-bleed image
- Play button overlay: centred white circle `w-10 h-10 bg-white/90 rounded-full shadow`, `Play` icon `w-5 h-5 text-blue-600`
- Duration badge: `absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded`
- Card body `p-3`:
  - Category: `text-xs font-semibold text-blue-600 uppercase tracking-wider`
  - Title: `text-sm font-semibold text-slate-900 font-display mt-0.5`
- **No edit or link controls** — student sees title and category only

---

### 8.2 Teacher Videos

> **Reference image:** `images/teacherLearningVideos.png`

**All student video elements present**, plus:

**Page header — action button (top-right):**
- `+ Upload Video` primary button: `bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700`

**Video card body — teacher additions (below title):**
- `Edit` ghost link: `text-sm text-slate-500 hover:text-blue-600`
- `Link to Model` ghost link: `text-sm text-slate-500 hover:text-blue-600`
- Both on same row, separated by a space: `mt-2 flex gap-3`

**Key differences from student view:**

| Element | Student | Teacher |
|---|---|---|
| Header upload button | ✗ not shown | ✓ `+ Upload Video` (blue) |
| Card: Edit link | ✗ | ✓ |
| Card: Link to Model link | ✗ | ✓ |

---

## 9. Page: Quizzes (Self-Assessment)

### 9.1 Student Quizzes

> **Reference image:** `images/studentQuizzes.png`

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

**Page header (no action button):**
- Heading: `text-3xl font-bold text-slate-900 font-display` — `Self-Assessment`
- Subheading: `mt-1 text-sm text-slate-500` — `Test your knowledge with MCQ and practical quizzes.`

**Quiz list shell:** `mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden`

**Quiz row:** `px-5 py-4 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer`

**Row layout (left → right):**
- Status icon: `w-5 h-5 flex-shrink-0`
  - Completed: `CheckCircle` `text-green-500`
  - Pending: `Clock` `text-amber-400`
- Quiz title: `text-sm font-semibold text-blue-600 flex-1`
- Meta row below title: `text-xs text-slate-400 mt-0.5` — `{N} questions   {X} mins`
- **Right side** (flex-end):
  - Type badge pill: `px-2 py-0.5 rounded-full text-xs font-medium`
    - MCQ: `bg-purple-100 text-purple-700`
    - Practical: `bg-indigo-100 text-indigo-700`
    - Mixed: `bg-blue-100 text-blue-700`
  - Student completed: `text-sm font-semibold text-slate-900` — `Score: 85%`
  - Student pending: `text-sm font-semibold text-blue-600 hover:text-blue-800` — `Start Quiz`

> From image: status icon + title + meta are grouped in a left column; badge + action are right-aligned on the same row as the title, with meta below on its own line.

---

### 9.2 Teacher Quizzes

> **Reference image:** `images/teacherQuizzes.png`

**All student quiz list elements present**, plus:

**Page header — action button (top-right):**
- `+ Create Quiz` primary button: `bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700`

**Each quiz row — right side (teacher):**
- Type badge pill (same as student)
- `Edit` ghost text: `text-sm text-slate-500 hover:text-blue-600`
- `View Results` ghost text: `text-sm text-slate-500 hover:text-blue-600`
- Both on one row, aligned right: `flex items-center gap-3`

> No `Score` or `Start Quiz` visible — teacher sees management controls only.

**Key differences from student view:**

| Element | Student | Teacher |
|---|---|---|
| Header action button | ✗ | ✓ `+ Create Quiz` (blue) |
| Row: Score / Start Quiz | ✓ (role-dependent) | ✗ |
| Row: Edit | ✗ | ✓ |
| Row: View Results | ✗ | ✓ |

---

## 10. Page: Library (Content Library)

### 10.1 Student Library

> **Reference image:** `images/studentContentLibrary.png`

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

**Page header (no action button):**
- Heading: `text-3xl font-bold text-slate-900 font-display` — `Content Library`
- Subheading: `mt-1 text-sm text-slate-500` — `Manage and download models, videos, and metadata.`

**File list shell:** `mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden`

**File row:** `px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors`

**Row layout:**
- File type icon: `w-8 h-8 flex-shrink-0`
  - `.glb` / `.obj` → `FileBox` `text-blue-500`
  - `.mp4` → `FileVideo` `text-purple-500`
  - `.json` → `FileText` `text-slate-400`
- File info (flex-1):
  - Name: `text-sm font-medium text-slate-900`
  - Meta: `text-xs text-slate-400 mt-0.5` — `{size} • Uploaded {date}`
- **Right side — download only:**
  - Download icon button: `p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors`
  - Icon: `Download w-4 h-4`
  - **No options (⋮) button** — student sees download only

**No upload drop zone** — student sees the file list only.

---

### 10.2 Teacher Library

> **Reference image:** `images/teacherContentLibrary.png`

**Page header — action button (top-right):**
- `⬆ Upload Content` primary button: `bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700`

**Upload drop zone (teacher only — appears above file list):**
`mt-6 mb-4 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center bg-white hover:bg-slate-50 transition-colors cursor-pointer`
- `Upload` icon: `mx-auto w-8 h-8 text-slate-400 mb-3`
- Heading: `text-sm font-semibold text-slate-700` — `Upload new content`
- Format note: `text-xs text-slate-400 mt-1` — `Support for .obj, .gltf, .glb, .usdz, .uasset, .mp4, .json`

**File list shell:** same as student — `bg-white rounded-xl border border-slate-200 overflow-hidden`

**Each file row — right side (teacher additions):**
- Download icon button (same as student)
- **Options button:** `p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors`
  - Icon: `MoreVertical w-4 h-4`

**Key differences from student view:**

| Element | Student | Teacher |
|---|---|---|
| Header upload button | ✗ | ✓ `⬆ Upload Content` (blue) |
| Upload drop zone | ✗ | ✓ dashed box above file list |
| Row: Download button | ✓ | ✓ |
| Row: Options (⋮) button | ✗ | ✓ |

---

## 11. Page: Login

**Container:** `min-h-screen bg-slate-50 flex items-center justify-center px-4`

**Card:** `bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-md p-8`

**Header (centred):**
- Logo mark: `w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3 mx-auto`
- Brand name: `text-2xl font-bold text-slate-900 font-display text-center`
- Subheading: `text-sm text-slate-500 text-center mt-1`

**Form:**
- Email field: label + input (full-width, standard input style)
- Password field: label + input with show/hide toggle
- Submit: full-width primary button — `Sign in`
- Error message: `text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2`
- Wireframe hint: `text-xs text-slate-400 text-center mt-3`

**Footer:** `text-sm text-slate-500 text-center mt-6` — `Don't have an account?` + register link

---

## 12. Page: Register

**Container:** same as Login — centred card layout

**Card:** `max-w-md` — same shell

**Form fields:**
- Full name input
- Email input
- Password input
- Role `<select>`: Student / Teacher
- Program `<select>`: Physiotherapy / Occupational Therapy / Radiography / Nursing
- Submit: full-width primary button — `Create account`

**Footer:** `Already have an account?` + login link

---

## 13. Reusable Component Patterns

### Button Variants

| Variant | Tailwind classes |
|---|---|
| Primary | `bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium` |
| Secondary | `border border-slate-200 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors px-4 py-2` |
| Ghost text | `text-sm text-slate-500 hover:text-blue-600 transition-colors` |
| Icon action (blue) | `p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors` |
| Icon action (muted) | `p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors` |

### Cards

```
bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow
```

### Stat Cards

```
bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4
```

### Form Inputs

```
w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400
focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors
```

### Badges / Pills

```
px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center
```

### File List Shell

```
bg-white rounded-xl border border-slate-200 overflow-hidden
```

### File List Row

```
px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors
```

### Quiz List Shell

Same as File List Shell.

### Quiz List Row

```
px-5 py-4 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer
```

---

## 14. Icon Library

All icons from `lucide-react`.

| Icon | Size | Usage |
|---|---|---|
| `GraduationCap` | `w-4 h-4` (nav), `w-5 h-5` (logo inner) | Dashboard nav, logo |
| `Box` | `w-4 h-4` (nav), `w-6 h-6` (stat), `w-12 h-12` (card) | 3D Viewer nav, stat card, learning card |
| `Video` | `w-4 h-4` (nav), `w-6 h-6` (stat) | Videos nav, Videos Linked stat |
| `BookOpen` | `w-4 h-4` (nav), `w-12 h-12` (card) | Quizzes nav, learning card |
| `Library` | `w-4 h-4` | Library nav |
| `UserCircle2` | `w-8 h-8` | User avatar |
| `Clock` | `w-5 h-5` (quiz row), `w-6 h-6` (stat) | Study Time stat, pending quiz |
| `Trophy` | `w-6 h-6` | Quiz Average stat |
| `Activity` | `w-6 h-6` | Models Explored / Student Engagement stat |
| `Play` | `w-5 h-5` | Video play button |
| `Plus` | `w-4 h-4` | Upload / Create action buttons |
| `Search` | `w-4 h-4` | Search input prefix |
| `CheckCircle` | `w-5 h-5` | Completed quiz status |
| `Upload` | `w-8 h-8` (drop zone), `w-4 h-4` (button) | Upload drop zone, Upload Content button |
| `Download` | `w-4 h-4` | File download button |
| `FileBox` | `w-8 h-8` | 3D model file type |
| `FileVideo` | `w-8 h-8` | Video file type |
| `FileText` | `w-8 h-8` | Data / JSON file type |
| `MoreVertical` | `w-4 h-4` | File options menu (teacher only) |
| `RotateCcw` | `w-4 h-4` | Reset view (3D toolbar) |
| `ZoomIn` | `w-4 h-4` | Zoom in (3D toolbar) |
| `ZoomOut` | `w-4 h-4` | Zoom out (3D toolbar) |
| `Move` | `w-4 h-4` (toolbar), `w-7 h-7` (panel) | Pan toolbar, empty state panel |
| `X` | `w-4 h-4` | Close panel / close video player |
| `LogOut` | `w-4 h-4` | Logout button |

---

## 15. Role Difference Summary — All Pages

Quick reference for implementing conditional rendering per role.

| Page | Student only | Teacher only |
|---|---|---|
| **Dashboard** | Study Time, Quiz Average, Models Explored stats; Continue Learning cards | Models Uploaded, Videos Linked, Student Engagement stats; Quick Actions buttons |
| **3D Viewer** | Empty state panel (no structure selected by default) | Add Label button (bottom-left canvas); Teacher Controls section in detail panel (Edit Description, Change Linked Video) |
| **Videos** | Video grid only (no controls below title) | `+ Upload Video` button in header; Edit + Link to Model links below each video title |
| **Quizzes** | Start Quiz / Score per row | `+ Create Quiz` button in header; Edit + View Results per row (no scores shown) |
| **Library** | Download button per row only; no upload drop zone | `⬆ Upload Content` button in header; upload drop zone above file list; Options (⋮) button per row |

---

## 16. Responsive Breakpoints

| Breakpoint | Nav | Grid columns | Viewer panel |
|---|---|---|---|
| Mobile (`< md`) | Nav links hidden (hamburger deferred) | 1 col | Panel slides over canvas on selection |
| Tablet (`md`) | Nav links visible | 2 col | Panel fixed at right, always visible |
| Desktop (`lg`) | Full nav | 3 col | Panel fixed at right, always visible |

---

## 17. Spacing & Sizing Reference

| Token | Value | Usage |
|---|---|---|
| Page horizontal padding | `px-4 sm:px-6 lg:px-8` | All page containers |
| Page vertical padding | `py-8` | All page containers |
| Page max-width | `max-w-7xl` | All page containers |
| Nav height | `h-16` (64px) | Top navigation |
| Stat card gap | `gap-5` | Stat card grid |
| Content card gap | `gap-4` to `gap-6` | Video / learning card grid |
| Section spacing | `mt-6` to `mt-8` | Between page sections |
| Stat card padding | `p-5` | Inside stat cards |
| Content card padding | `p-3` to `p-4` | Inside video / quiz cards |
| File/quiz row padding | `px-5 py-4` | Inside list rows |
| Video thumbnail height | `h-44` | Video card image |
| Learning card header | `h-32` | Dashboard quick-link card |
| Viewer side panel width | `w-80` (320px) | 3D viewer detail panel |
| Upload drop zone | `p-10` | Teacher library drop zone |
| Logo mark | `w-8 h-8` (nav), `w-12 h-12` (auth pages) | Logo sizes |
