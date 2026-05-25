# design.md — AnatoLearn UI & Visual Design Specification

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
| `--color-brand` | `#2563EB` | Primary actions, active nav |
| `--color-brand-light` | `#EFF6FF` | Brand hover/active backgrounds |
| `--color-brand-hover` | `#1D4ED8` | Button hover |
| `--color-success` | `#10B981` | Completed states |
| `--color-warning` | `#F59E0B` | Pending states |
| `--color-purple` | `#7C3AED` | Video category accents |

---

## 3. Typography Scale

| Role | Font | Weight | Size |
|---|---|---|---|
| Page heading | DM Sans | 700 | 30px (`text-3xl`) |
| Section heading | DM Sans | 500 | 18px (`text-lg`) |
| Card title | DM Sans | 500 | 18px (`text-lg`) |
| Body | IBM Plex Sans | 400 | 14px (`text-sm`) |
| Label / badge | IBM Plex Sans | 500 | 12px (`text-xs`) |
| Stat value | DM Sans | 600 | 24px (`text-2xl`) |

---

## 4. Global Layout Shell

```
┌─────────────────────────────────────────────────────┐
│  TOP NAVIGATION BAR (sticky, h-16, white, z-50)     │
│  [Logo] [AnatoLearn] [Nav Links]   [Program][Role][User] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  MAIN CONTENT AREA (flex-1, renders page)           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Page background: `bg-slate-50 min-h-screen`.

---

## 5. Top Navigation Bar

**Height:** 64px (`h-16`), `bg-white`, `border-b border-slate-200`, sticky top-0.

### Left Side
- **Logo mark:** 32×32px `bg-blue-600` rounded square (`rounded-lg`) with white icon inside
- **Brand name:** `AnatoLearn` — `font-bold text-xl text-slate-900 tracking-tight`
- **Desktop nav links** (hidden on mobile, `md:flex`, `space-x-1`):
  - Each link: `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors`
  - Active: `bg-blue-50 text-blue-700`
  - Inactive: `text-slate-600 hover:bg-slate-100 hover:text-slate-900`
  - Icons: 16×16px (`w-4 h-4`)

| Nav Item | Icon |
|---|---|
| Dashboard | `GraduationCap` |
| 3D Viewer | `BoxIcon` |
| Videos | `Video` |
| Quizzes | `BookOpen` |
| Library | `Library` |

### Right Side (left to right)
1. **Program label:** `text-xs font-medium text-slate-500 uppercase tracking-wider`
2. **Program `<select>`:** `pl-3 pr-10 py-1.5 text-sm border-slate-300 rounded-md bg-slate-50 border`
3. **Vertical divider:** `h-6 w-px bg-slate-200`
4. **Role toggle pill** (`bg-slate-100 p-1 rounded-lg`):
   - Active button: `bg-white text-slate-900 shadow-sm px-3 py-1 text-sm font-medium rounded-md`
   - Inactive button: `text-slate-500 hover:text-slate-700`
5. **User avatar:** `UserCircle2` icon `w-8 h-8 text-slate-400`, ghost icon button

---

## 6. Page: Dashboard

**Max width container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

### Header Block
- Heading: `text-3xl font-bold text-slate-900` — `Welcome back, [Student | Instructor]`
- Subheading: `mt-2 text-slate-600` — `[Program] Program Overview`

### Stat Cards (3-column responsive grid)

**Grid:** `grid grid-cols-1 gap-5 sm:grid-cols-3`

**Card shell:** `bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-5`

**Card layout:** icon left (flex-shrink-0), metric right (w-0 flex-1)
- Label: `text-sm font-medium text-slate-500 truncate`
- Value: `text-2xl font-semibold text-slate-900`

| View | Card | Icon | Color |
|---|---|---|---|
| Student | Study Time | `Clock` | `text-blue-500` |
| Student | Quiz Average | `Trophy` | `text-yellow-500` |
| Student | Models Explored | `Activity` | `text-green-500` |
| Teacher | Models Uploaded | box icon | `text-blue-500` |
| Teacher | Videos Linked | `Video` | `text-purple-500` |
| Teacher | Student Engagement | `Activity` | `text-green-500` |

### Student — Continue Learning Cards

**Section heading:** `text-lg font-medium text-slate-900 mb-4`

**Grid:** `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`

**Card shell:** `group block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow`

**Card image header** (`h-32`):
- Gradient background with icon (scales on group hover `group-hover:scale-110 transition-transform`)
- Gradients: blue→indigo (Viewer), purple→pink (Videos), green→emerald (Quizzes)

**Card body** (`p-4`):
- Title: `text-lg font-medium text-slate-900`
- Subtitle: `mt-1 text-sm text-slate-500`

### Teacher — Quick Actions

**Grid:** `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`

**Button:** `flex items-center justify-center px-4 py-4 border border-slate-200 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50`

---

## 7. Page: Videos

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

### Header
- Heading: `text-3xl font-bold text-slate-900`
- Subtext: `mt-2 text-slate-600`
- Teacher only: primary button (`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2`) with `Plus` icon

### Search + Filter Bar (`mb-6 flex gap-4`)
- Search input: `relative flex-1 max-w-md`, `Search` icon prefix (`pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm`)
- Category select: `w-48 pl-3 pr-10 py-2 text-base border-slate-300 rounded-md text-sm`

### Video Grid

**Grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`

**Card:** `bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer`

**Thumbnail area** (`relative h-48`):
- Image: `w-full h-full object-cover`
- Overlay: `absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all`
- Play button: 48×48px `bg-white bg-opacity-90 rounded-full`, `Play` icon `w-6 h-6 text-blue-600 ml-1`, scales on hover
- Duration badge: `absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded`

**Card body** (`p-4`):
- Category: `text-xs font-medium text-blue-600 mb-1 uppercase tracking-wider`
- Title: `text-lg font-medium text-slate-900 line-clamp-2`
- Teacher only: Edit + Link to Model ghost text buttons (`text-sm text-slate-600 hover:text-blue-600 mt-4 flex gap-2`)

---

## 8. Page: Quizzes

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

### Header
- Same pattern as Videos header
- Teacher only: `Create Quiz` primary button with `Plus` icon

### Quiz List

**Shell:** `bg-white shadow overflow-hidden sm:rounded-md border border-slate-200`

**Row:** `px-4 py-4 sm:px-6 hover:bg-slate-50 transition-colors cursor-pointer`

**Top row:** status icon + title (blue) on left; type badge pill on right

**Badge colors:**
- MCQ: `bg-purple-100 text-purple-800`
- Practical: `bg-indigo-100 text-indigo-800`
- Mixed: `bg-blue-100 text-blue-800`

**Badge shape:** `px-2 inline-flex text-xs leading-5 font-semibold rounded-full`

**Meta row:** `text-sm text-slate-500` — question count + time limit

**Right action (student):**
- Completed: `font-medium text-slate-900` score display
- Pending: `text-blue-600 hover:text-blue-800 font-medium` Start Quiz link

**Right action (teacher):** Edit + View Results ghost text buttons

**Status icons:**
- Completed: `CheckCircle w-5 h-5 text-green-500`
- Pending: `Clock w-5 h-5 text-amber-500`

---

## 9. Page: Library

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`

### Teacher Upload Drop Zone
`mb-8 border-2 border-dashed border-slate-300 rounded-lg p-12 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer`
- `Upload` icon: `mx-auto h-12 w-12 text-slate-400`
- Heading: `mt-2 text-sm font-medium text-slate-900`
- Format note: `mt-1 text-xs text-slate-500`

### File List

**Shell:** `bg-white shadow overflow-hidden sm:rounded-md border border-slate-200`

**Row:** `px-4 py-4 flex items-center justify-between sm:px-6 hover:bg-slate-50 transition-colors`

**File icon by type:**
- `model` → `FileBox w-6 h-6 text-blue-500`
- `video` → `FileVideo w-6 h-6 text-purple-500`
- `data` → `FileText w-6 h-6 text-slate-500`

**File info:**
- Name: `text-sm font-medium text-slate-900`
- Meta: `text-xs text-slate-500` — size + uploaded date

**Action buttons:**
- Download: `p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors`
- Teacher options: `p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100`

---

## 10. Page: 3D Viewer

### Layout
`flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden`
- **Left (main canvas):** `flex-1 relative bg-slate-50`
- **Right (detail panel):** `w-full md:w-96 bg-white border-l border-slate-200 flex flex-col`

### Viewer Toolbar (top-left overlay)
`absolute top-4 left-4 z-10 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-md border border-slate-200`

Icon buttons: `p-2 text-slate-600 hover:bg-slate-100 rounded-md`

Icons (top to bottom): `RotateCcw`, `ZoomIn`, `ZoomOut`, `Move`

### System Selector (top-right overlay)
`absolute top-4 right-4 z-10 bg-white rounded-lg shadow-md border border-slate-200 p-2`
- `<select>` with `text-sm border-slate-300 rounded-md`

### Teacher Controls Overlay (bottom-left)
`absolute bottom-4 left-4 z-10 flex gap-2`
- Add Label button (default): `bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2`
- Add Label button (active): `bg-amber-500 text-white`
- Instruction badge: `bg-white px-4 py-2 rounded-lg shadow-md border border-slate-200 text-sm text-slate-700`

### Detail Side Panel

**Empty state (no selection):**
`flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500`
- Icon circle: `w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4`
- `Move` icon: `w-8 h-8 text-slate-400`
- Heading: `text-lg font-medium text-slate-900 mb-2`

**Part selected:**
- Part name: `text-2xl font-bold text-slate-900`
- Close `X` button (mobile only): `p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100`
- Program badge: `bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-medium`
- Description section heading: `text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2`
- Description text: `prose prose-sm text-slate-600`

**Video section:**
- Thumbnail (no video): `aspect-video bg-slate-100 rounded-lg overflow-hidden cursor-pointer border border-slate-200 hover:border-blue-500`
  - Image: `w-full h-full object-cover opacity-80 group-hover:opacity-100`
  - Play button: 48×48px white circle, `Play` icon blue
- Video player: `aspect-video bg-black rounded-lg overflow-hidden relative`
  - Close `X`: `absolute top-2 right-2 p-1 bg-black bg-opacity-50 text-white rounded-full`

**Teacher controls (teacher only, part selected):**
`mt-auto pt-6 border-t border-slate-200`
- Edit Description button: full-width secondary button
- Change Linked Video button: full-width secondary button

**Panel slide animation:**
- Selected: `translate-x-0`
- No selection: `translate-x-full md:translate-x-0 hidden md:flex`

---

## 11. Reusable Component Patterns

### Button Variants

| Variant | Classes |
|---|---|
| Primary | `bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2` |
| Secondary | `border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50` |
| Ghost text | `text-blue-600 hover:text-blue-800 font-medium text-sm` |
| Icon action | `p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors` |
| Icon muted | `p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors` |

### Cards
```
bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow
```

### Stat Cards
```
bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-5
```

### Form Inputs
```
border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
```

### Badges / Pills
```
px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center
```

---

## 12. Icon Library

All icons from `lucide-react`. Standard size: `w-4 h-4` (nav), `w-5 h-5` (actions), `w-6 h-6` (stat cards), `w-8 h-8` (user avatar).

| Icon | Usage |
|---|---|
| `GraduationCap` | Dashboard nav |
| `BoxIcon` | 3D Viewer nav |
| `Video` | Videos nav + stat |
| `BookOpen` | Quizzes nav |
| `Library` | Library nav |
| `UserCircle2` | User avatar |
| `Clock` | Study time stat, pending quiz |
| `Trophy` | Quiz average stat |
| `Activity` | Models explored / engagement stat |
| `Play` | Video play button |
| `Plus` | Upload / create actions |
| `Search` | Search input prefix |
| `CheckCircle` | Completed quiz status |
| `Upload` | Upload action / drop zone |
| `Download` | File download |
| `FileBox` | 3D model file |
| `FileVideo` | Video file |
| `FileText` | Data file |
| `MoreVertical` | File options menu |
| `RotateCcw` | Reset view (3D) |
| `ZoomIn` | Zoom in (3D) |
| `ZoomOut` | Zoom out (3D) |
| `Move` | Pan / empty state (3D) |
| `X` | Close panel / video |

---

## 13. Responsive Breakpoints

| Breakpoint | Nav | Grid columns | Viewer panel |
|---|---|---|---|
| Mobile (`< md`) | Nav links hidden | 1 col | Slides over canvas, `translate-x-full` when empty |
| Tablet (`md`) | Nav links visible | 2 col | Always shown side-by-side |
| Desktop (`lg`) | Full nav | 3 col | Always shown side-by-side |

---

## 14. Spacing & Sizing Reference

| Token | Value | Use |
|---|---|---|
| Page horizontal padding | `px-4 sm:px-6 lg:px-8` | All page containers |
| Page vertical padding | `py-8` | All page containers |
| Page max-width | `max-w-7xl` | All page containers |
| Nav height | `h-16` (64px) | Top navigation |
| Card gap | `gap-5` (stat) / `gap-6` (content) | Grid gaps |
| Section gap | `mb-8` | Between page sections |
| Card padding | `p-5` (stat) / `p-4` (content) | Inside cards |
| Video thumbnail | `h-48` | Video card images |
| Quick-link header | `h-32` | Dashboard card images |
| Viewer panel width | `w-96` (384px) | 3D viewer side panel |
