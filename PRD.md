# PRD.md — AnatoLearn Product Requirements

## 1. Product Overview

### Working Title
**AnatoLearn**

### One-Liner
A web-based anatomy education platform for allied health students and instructors, combining an interactive 3D model viewer, educational videos, self-assessment quizzes, and a content library — all filtered by healthcare program and user role.

### Core Pitch
AnatoLearn allows students to explore 3D anatomical models, watch linked educational videos, and test their knowledge through quizzes. Instructors can upload content, annotate 3D models with labels, and manage the content library — without needing to edit code.

---

## 2. Target Users

### Primary Audience
- Allied health students (Physiotherapy, Occupational Therapy, Radiography, Nursing programs)
- Instructors and educators in allied health institutions

### User Roles
| Role | Access |
|---|---|
| Student | View 3D models, watch videos, take quizzes, browse library |
| Teacher | All student access + upload content, label models, create quizzes, manage library |

---

## 3. Platform

### Stack
- React + TypeScript (frontend)
- Vite (build)
- Tailwind CSS (styling)
- Three.js + OrbitControls (3D viewer)
- React Router v6 (navigation)
- Lucide React (icons)

### Target Build
- Desktop web (primary)
- Mobile responsive (secondary)

---

## 4. Core Features

### 4.1 Program Filter
The user selects their program from the top navigation bar. This filters content throughout the app.

Programs:
- Physiotherapy (PT)
- Occupational Therapy (OT)
- Radiography
- Nursing

### 4.2 Role Toggle
The user switches between Student and Teacher views from the top navigation bar. Role affects which controls and actions are visible on every page.

### 4.3 3D Anatomy Viewer
- Loads interactive 3D anatomical models in the browser
- Supports orbit (rotate), zoom, and pan controls
- Clicking a labelled structure opens a detail panel
- Detail panel shows: name, program badge, description, linked video
- Teacher can add labels by clicking on the model
- Teacher can edit label descriptions and change linked videos
- System selector dropdown switches between anatomical systems

### 4.4 Educational Videos
- Grid of bite-sized anatomical video explanations
- Search by keyword
- Filter by anatomical system/category
- Clicking a card plays the video
- Teacher can upload new videos
- Teacher can link videos to 3D model structures

### 4.5 Self-Assessment Quizzes
- List view of quizzes with status (completed / pending) and type badges
- Student can start pending quizzes and see completed scores
- Teacher can create new quizzes, edit existing ones, and view results
- Quiz types: MCQ, Practical, Mixed

### 4.6 Content Library
- File list showing uploaded models, videos, and metadata files
- All users can download files
- Teacher only: upload drop zone, upload button, file options menu
- Supported file formats: `.obj`, `.gltf`, `.glb`, `.usdz`, `.uasset`, `.mp4`, `.json`

### 4.7 Dashboard
- Student view: personal stats (study time, quiz average, models explored) + continue learning cards linking to recent content
- Teacher view: content stats (models uploaded, videos linked, student engagement) + quick action buttons for common tasks

---

## 5. Navigation Structure

| Path | Page | Description |
|---|---|---|
| `/` | Dashboard | Overview and quick access |
| `/viewer` | 3D Viewer | Interactive anatomy exploration |
| `/videos` | Videos | Educational video library |
| `/quizzes` | Quizzes | Self-assessment |
| `/library` | Library | Content file management |

---

## 6. Role-Gated UI Summary

| Feature | Student | Teacher |
|---|---|---|
| View 3D models | ✓ | ✓ |
| Click structure → detail panel | ✓ | ✓ |
| Play linked video | ✓ | ✓ |
| Add label to model | ✗ | ✓ |
| Edit label / change video | ✗ | ✓ |
| Watch videos | ✓ | ✓ |
| Upload video | ✗ | ✓ |
| Link video to model | ✗ | ✓ |
| Take quiz | ✓ | ✗ |
| Create quiz | ✗ | ✓ |
| View results | Own scores only | All student results |
| Download library files | ✓ | ✓ |
| Upload to library | ✗ | ✓ |
| File options menu | ✗ | ✓ |

---

## 7. Global State

Managed via React Context (`AppContext`):

| State | Type | Values | Default |
|---|---|---|---|
| `role` | `Role` | `'student'` \| `'teacher'` | `'student'` |
| `program` | `Program` | `'PT'` \| `'OT'` \| `'Radiography'` \| `'Nursing'` | `'PT'` |

Both values affect content and controls throughout all pages.

---

## 8. Content Data (Mock — Prototype)

### Videos
| Title | Duration | Category |
|---|---|---|
| Introduction to the Muscular System | 5:23 | Muscular |
| How the Heart Works | 8:45 | Cardiovascular |
| Respiratory Mechanics | 6:12 | Respiratory |

### Quizzes
| Title | Type | Questions | Time | Status |
|---|---|---|---|---|
| Muscular System Basics | MCQ | 15 | 20 mins | completed (85%) |
| Cardiovascular Anatomy Practical | Practical | 5 | 30 mins | pending |
| Respiratory System Review | Mixed | 20 | 45 mins | pending |

### Library Files
| Name | Type | Size | Date |
|---|---|---|---|
| Full_Body_Muscular.glb | model | 24.5 MB | Oct 12, 2023 |
| Heart_Cross_Section.obj | model | 12.1 MB | Oct 15, 2023 |
| Muscle_Contraction_Explained.mp4 | video | 45.2 MB | Oct 18, 2023 |
| Respiratory_Labels.json | data | 12 KB | Oct 20, 2023 |

### 3D Anatomy Parts (Mock)
| ID | Name | Description |
|---|---|---|
| part-1 | Biceps Brachii | Two-headed muscle on the upper arm |
| part-2 | Pectoralis Major | Large muscle of the chest |
| part-3 | Rectus Abdominis | Paired vertical muscle on the anterior abdomen |

---

## 9. Non-Functional Requirements

### Maintainability
- Role-gated UI controlled only through the shared `role` context value — no hardcoded branching per page
- Program filtering controlled only through the shared `program` context value
- Adding new programs should require only a new `<option>` in the selector

### Extensibility
It should be easy to add:
- New programs (new option in selector)
- New nav items (new entry in `navItems` array)
- New video categories (new option in filter dropdown)
- New quiz types (new badge color mapping)
- New library file types (new icon mapping)

### Accessibility
- All interactive elements must be keyboard accessible
- Missing images must show placeholders (no broken image crashes)
- Icon-only buttons must have `title` attributes

### Performance
- Three.js resources (geometry, materials, renderer) must be fully disposed on component unmount
- Camera aspect ratio and renderer size must update on window resize
- UI should only refresh when state changes — avoid polling

---

## 10. Minimum Viable Product

The MVP must include:

1. Working top navigation with program switcher and role toggle
2. Dashboard with role-specific stats and quick-access cards
3. 3D viewer with orbit controls and clickable labelled structures
4. Detail panel with description and linked video playback
5. Video grid with search input and category filter
6. Quiz list with student start/score and teacher manage actions
7. Library file list with download; teacher upload drop zone
8. All pages connected through React Router
9. Role and program state shared via context across all pages
10. Responsive layout working at mobile and desktop breakpoints
