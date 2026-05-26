# PRD.md — AnatoLearn Product Requirements

## 1. Product Overview

### Working Title
**AnatoLearn**

### One-Liner
A web-based anatomy education platform for allied health students and instructors, combining an interactive 3D model viewer, educational videos, self-assessment quizzes, learning materials, and other links — all organised by healthcare programme and secured by role-based access control.

### Core Pitch
AnatoLearn replaces the current Sketchfab-based workflow with a self-hosted platform. Students explore interactive 3D anatomical models, watch bite-sized animated videos linked directly to body parts, test their knowledge through MCQ and practical quizzes, and access programme-specific learning materials. Instructors upload and manage all content through a dedicated teacher interface — without editing code.

---

## 2. Target Users

### Primary Audience
- Allied health students: Physiotherapy (PT), Occupational Therapy (OT), Radiography, Nursing
- Instructors and educators in allied health institutions

### User Roles

| Role | Access Level |
|---|---|
| Student | All five platform sections (read-only). Download only if teacher-enabled. |
| Teacher | Full student access + content management: upload, label, publish, configure quizzes, manage downloads. |

Both roles require authentication. No content is accessible to unauthenticated users.

---

## 3. Platform

### Frontend Stack
- React + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Three.js + OrbitControls (3D viewer)
- React Router v6 (navigation)
- Lucide React (icons)

### Backend Stack
- Node.js + Express or Python + FastAPI (TBC)
- PostgreSQL or SQLite (database)
- Local file storage → future cloud migration (TBC: Stella or equivalent)
- JWT-based authentication

### Target Build
- Desktop web (primary — Chrome, Edge, Firefox, Safari)
- Mobile responsive (secondary)

---

## 4. Platform Sections

The platform has five primary page sections accessible to all authenticated users:

| Section | Path | Description |
|---|---|---|
| Dashboard | `/dashboard` | Overview and quick access to learning activity |
| 3D Viewer | `/3dviewer` | Interactive 3D anatomy viewer with labels and linked videos |
| Animated Videos | `/videos` | Browsable library of bite-sized educational videos |
| Self-Assessment | `/quizzes` | MCQ and practical quiz module with scoring and history |
| Library | `/library` | Models, learning materials, downloadable files, and teacher-curated links |

---

## 5. Navigation Structure

| Path | Page | Auth Required | Description |
|---|---|---|---|
| `/login` | Login | No | Username and password login |
| `/register` | Register | No | New user registration |
| `/` | Redirect | No | Redirects to `/dashboard` |
| `/dashboard` | Dashboard | Yes | Overview and quick access |
| `/3dviewer` | 3D Viewer | Yes | Interactive anatomy exploration |
| `/videos` | Animated Videos | Yes | Educational video library |
| `/quizzes` | Self-Assessment | Yes | Quiz attempt and management |
| `/library` | Library | Yes | Models, learning materials, file upload/download, and teacher-curated links |

Unauthenticated users are redirected to `/login` when accessing any auth-required route. Role guards apply only to pages or workflows that are exclusively student-only or teacher-only. Shared pages render role-specific controls through JSX conditionals using the JWT-derived role.

---

## 6. Role-Gated Feature Summary

| Feature | Student | Teacher |
|---|---|---|
| Access all five platform sections | ✓ | ✓ |
| View 3D models | ✓ | ✓ |
| Browse models by body system | ✓ | ✓ |
| Browse models by body part | ✓ | ✓ |
| Search models, systems, parts, videos | ✓ | ✓ |
| Zoom, rotate, pan 3D model | ✓ | ✓ |
| Click label → view name + description | ✓ | ✓ |
| Highlight selected body part | ✓ | ✓ |
| Reset model to default position | ✓ | ✓ |
| Play linked video from label | ✓ | ✓ |
| Browse all animated videos | ✓ | ✓ |
| Take MCQ and practical quizzes | ✓ | ✗ |
| View quiz score after submission | ✓ | ✗ |
| View own quiz history | ✓ | ✗ |
| Download models (if teacher-enabled) | ✓ | ✓ |
| Download blocked models | ✗ | ✗ |
| Access learning materials | ✓ | ✓ |
| Access Other Links | ✓ | ✓ |
| Upload 3D model files | ✗ | ✓ |
| Preview model before publishing | ✗ | ✓ |
| Create, edit, delete labels | ✗ | ✓ |
| Define label position on model | ✗ | ✓ |
| Link label to video | ✗ | ✓ |
| Upload animated videos | ✗ | ✓ |
| Create, edit, delete quiz questions | ✗ | ✓ |
| Manage question bank | ✗ | ✓ |
| Configure quiz timer | ✗ | ✓ |
| Organise content by body system / part | ✗ | ✓ |
| Enable / disable model download | ✗ | ✓ |
| Manage content visibility | ✗ | ✓ |
| Upload learning materials | ✗ | ✓ |
| Organise materials by programme | ✗ | ✓ |
| Add, edit, delete Other Links | ✗ | ✓ |
| View all students' quiz results | ✗ | ✓ |

---

## 7. Functional Requirements

### 7.1 Student Requirements

| ID | Requirement | 
|---|---|
| FR-1 | The system shall allow students to access all five page sections: Dashboard, 3D Viewer, Animated Videos, Self-Assessment, and Library. | 
| FR-2 | The system shall allow students to view 3D anatomy models on the web platform. | 
| FR-3 | The system shall allow students to browse 3D anatomy models by body system, such as muscular system, skeletal system, or digestive system. | 
| FR-4 | The system shall allow students to browse 3D anatomy models by body part, such as head, mouth, arm, leg, or selected muscle. | 
| FR-5 | The system shall allow students to search for models, body systems, body parts, and videos. | 
| FR-6 | The system shall allow students to zoom in and zoom out of the 3D model. | 
| FR-7 | The system shall allow students to rotate and inspect the 3D model from different angles. | 
| FR-8 | The system shall allow students to select and interact with labelled body parts or muscles on the 3D model. | 
| FR-9 | The system shall allow students to view the name and description of a selected labelled body part or muscle. | 
| FR-10 | The system shall allow students to highlight a selected body part or muscle by interacting with its label. | 
| FR-11 | The system shall allow students to reset the 3D model back to its default viewing position. | 
| FR-12 | The system shall allow students to watch bite-sized animated videos explaining selected body parts or muscles. | 
| FR-13 | The system shall allow students to play the linked video when a body part or label is selected. | 
| FR-14 | The system shall allow students to access a separate video section containing all available animated videos. | 
| FR-15 | The system shall allow students to attempt self-assessment quizzes, including MCQ (theory) and open-ended practical assessments. | 
| FR-16 | The system shall display quiz scores to students after they complete an assessment. | 
| FR-17 | The system shall allow students to view previous quiz attempts and quiz history. | 
| FR-18 | The system shall track student quiz attempts and scores. | 
| FR-19 | The system shall allow students to download supported 3D model files only when download permission is granted. | 
| FR-20 | The system shall prevent students from downloading models that are not marked as downloadable by teachers. | 
| FR-21 | The system shall retrieve and display labels associated with the relevant 3D model. | 
| FR-22 | The system shall retrieve and display videos associated with the relevant body part or label. | 
| FR-23 | The system shall allow students to access learning materials including lecture notes, links, and photos. | 
| FR-24 | The system shall allow students to browse learning materials organised by programme, such as PT, OT, Radiography, and Nursing. | 
| FR-25 | The system shall allow students to access hyperlinks provided by teachers inside the Library page. | 

### 7.2 Authentication Requirements

| ID | Requirement |
|---|---|
| FR-26 | The system shall allow users to log in using a username and password. | 
| FR-27 | The system shall allow users to log out of the system. | 
| FR-28 | The system shall restrict access to all platform content to authenticated users only. | 

### 7.3 Teacher Requirements

| ID | Requirement |
|---|---|
| FR-29 | The system shall allow teachers to access a teacher interface for managing teaching content. | 
| FR-30 | The system shall allow teachers to upload 3D model files. | 
| FR-31 | The system shall allow teachers to upload and manage supported 3D model formats including .obj, .gltf, .usdz, and .uasset where technically feasible. | 
| FR-32 | The system shall allow teachers to import externally hosted or externally created 3D anatomy models into the platform. | 
| FR-33 | The system shall validate uploaded 3D model files against supported file formats before storage. | 
| FR-34 | The system shall allow teachers to preview uploaded 3D models before publishing them to students. | 
| FR-35 | The system shall allow teachers to upload bite-sized animated videos. | 
| FR-36 | The system shall allow teachers to create, edit, and delete body-part labels. | 
| FR-37 | The system shall allow teachers to define and modify the position of labels on the 3D model. | 
| FR-38 | The system shall store label positioning data associated with individual 3D models. | 
| FR-39 | The system shall allow teachers to edit names and descriptions associated with body-part labels. | 
| FR-40 | The system shall allow teachers to link a label or body part to a specific video. | 
| FR-41 | The system shall store metadata for models, labels, videos, and quizzes. | 
| FR-42 | The system shall allow teachers to create, edit, and delete self-assessment quiz questions for both MCQ (theory) and open-ended practical assessment types. | 
| FR-42a | The system shall support a question bank from which quiz questions can be drawn for assessments. | 
| FR-42b | The system shall allow teachers to organise quiz questions by body system category, such as respiratory system, cardiovascular system, and musculoskeletal system. | 
| FR-42c | The system shall allow teachers to configure a timer for quiz assessments. | 
| FR-43 | The system shall allow teachers to organise models, videos, labels, and quizzes by body system or body part. | 
| FR-44 | The system shall allow teachers to manage which content is visible to students. | 
| FR-45 | The system shall allow teachers to upload and manage downloadable model resources. | 
| FR-46 | The system shall allow teachers to enable or disable downloadable access for individual models. | 
| FR-47 | The system shall support downloading model files in formats such as .obj, .gltf, .usdz, and .uasset where technically feasible. | 
| FR-48 | The system shall preserve associated labels and metadata when downloadable model formats support embedded metadata. | 
| FR-49 | The system shall allow teachers to store uploaded teaching content. | 
| FR-49a | The system shall allow teachers to upload and manage materials including lecture notes, links, and photos. | 
| FR-49b | The system shall allow teachers to organise learning materials by programme, such as PT, OT, Radiography, and Nursing. | 
| FR-49c | The system shall support programme-specific content variation, allowing different programmes to have access to different sets of learning materials. | 
| FR-49d | The system shall allow teachers to add, edit, and delete hyperlinks inside the Library page. | 
| FR-50 | The system shall support future integration with cloud-based object storage services for uploaded teaching content. | 
| FR-51 | The system shall abstract file storage access so uploaded teaching content can be migrated from local storage to the confirmed cloud platform without changing page-level application logic. |

### 7.4 Sketchfab Migration Requirements

| ID | Requirement | 
|---|---|
| FR-SM-1 | The system shall support importing 3D model files previously hosted on Sketchfab into the platform. | 
| FR-SM-2 | The system shall allow teachers to annotate directly on 3D models within the platform. | 

### 7.5 Cloud and Storage Requirements

| ID | Requirement | 
|---|---|
| FR-CS-1 | The system shall support future integration with cloud-based object storage services for uploaded teaching content. | 
| FR-CS-2 | The system shall be designed so stored teaching content can later be migrated to the confirmed cloud platform (TBC). | 

---

## 8. Non-Functional Requirements

### 8.1 Usability

| ID | Requirement | 
|---|---|
| NFR-1 | The system shall provide a user-friendly interface suitable for students and teachers with minimal training. | 
| NFR-2 | The system shall maintain consistent navigation and layout across all pages. | 
| NFR-3 | The system shall provide clear visual feedback when users interact with labels, quizzes, videos, or 3D models. | 
| NFR-4 | The system shall display meaningful error messages for failed uploads, downloads, or invalid actions. | 
| NFR-5 | The system shall support responsive viewing on standard desktop sizes. | 

### 8.2 Performance

| ID | Requirement | 
|---|---|
| NFR-6 | The system shall provide smooth zooming, rotating, and interaction with 3D models under normal usage conditions. | 
| NFR-7 | The system shall load standard-sized 3D models within an acceptable response time under normal network conditions. | 
| NFR-8 | The system shall support concurrent access by multiple student users during teaching sessions. | 
| NFR-9 | The system shall provide responsive playback for animated educational videos. | 
| NFR-10 | The system shall be designed to minimise 3D model loading latency through appropriate database structure and storage optimisation. | 

### 8.3 Security and Access Control

| ID | Requirement | 
|---|---|
| NFR-11 | The system shall implement role-based access control for teacher and student accounts. | 
| NFR-12 | The system shall prevent students from creating, editing, deleting, or publishing teacher-managed content. | 
| NFR-13 | The system shall restrict all teaching content, 3D models, and associated materials to authenticated platform users only. Content shall not be shareable or accessible outside the platform. | 
| NFR-14 | The system shall validate uploaded files to ensure only supported file formats are accepted. | 
| NFR-15 | The system shall protect stored teaching content and metadata from unauthorised modification. | 
| NFR-16 | The system shall restrict downloadable resources based on teacher permissions. | 

### 8.4 Compatibility

| ID | Requirement |
|---|---|
| NFR-17 | The system shall be accessible through common modern web browsers including Chrome, Edge, Firefox, and Safari. | 
| NFR-18 | The system shall support standard 3D model formats including .obj, .gltf, .usdz, and .uasset where technically feasible. | 
| NFR-19 | The system shall support importing externally created 3D anatomy models. | 

### 8.5 Scalability and Maintainability

| ID | Requirement |
|---|---|
| NFR-20 | The system shall allow additional models, labels, videos, quizzes, and body systems to be added without major redesign. | 
| NFR-21 | The system shall organise teaching content and metadata in a structured manner for future expansion. | 
| NFR-22 | The system shall allow additional programmes to be added without requiring major structural redesign. | 
| NFR-23 | The system shall separate storage logic from application logic to support future cloud migration. | 
| NFR-24 | The system shall support future integration with cloud-based object storage services (TBC: Stella or equivalent). | TBC |

### 8.6 Data Integrity and Reliability

| ID | Requirement |
|---|---|
| NFR-25 | The system shall preserve consistency between models, labels, linked videos, and quizzes. | 
| NFR-26 | The system shall reliably retrieve associated labels and metadata when loading 3D models. | 
| NFR-27 | The system shall maintain uploaded teaching content without unintended data loss during normal operation. | 
| NFR-28 | The system shall support backup or recovery of uploaded teaching content where technically feasible. | 

---

## 9. Global State

Managed via React Context (`AppContext`) after login. `role` and `program` are decoded from the authenticated user's JWT and stored in context for app-wide rendering decisions.

| State | Type | Values | Default |
|---|---|---|---|
| `role` | `Role` | `'student'` \| `'teacher'` | `'student'` |
| `program` | `Program` | `'PT'` \| `'OT'` \| `'Radiography'` \| `'Nursing'` | `'PT'` |

Both values affect visible content and controls throughout shared pages. Authentication and route access are enforced separately through protected routes.

---

## 10. Content Data (Mock — Prototype)

### 3D Models
| ID | Name | Body System | Body Part |
|---|---|---|---|
| model-1 | Full Body Muscular | Muscular | Full Body |
| model-2 | Heart Cross Section | Cardiovascular | Chest |
| model-3 | Respiratory Tract | Respiratory | Chest |

### Anatomy Labels (Mock)
| ID | Name | Description |
|---|---|---|
| part-1 | Biceps Brachii | Two-headed muscle on the upper arm between the shoulder and elbow |
| part-2 | Pectoralis Major | Large fan-shaped muscle across the chest wall |
| part-3 | Rectus Abdominis | Paired vertical muscle on the anterior abdominal wall |

### Animated Videos
| Title | Duration | Category | Linked Label |
|---|---|---|---|
| Introduction to the Muscular System | 5:23 | Muscular | Biceps Brachii |
| How the Heart Works | 8:45 | Cardiovascular | — |
| Respiratory Mechanics | 6:12 | Respiratory | — |

### Quizzes
| Title | Type | Questions | Timer | Body System |
|---|---|---|---|---|
| Muscular System Basics | MCQ | 15 | 20 mins | Muscular |
| Cardiovascular Anatomy Practical | Practical | 5 | 30 mins | Cardiovascular |
| Respiratory System Review | Mixed | 20 | 45 mins | Respiratory |

### Library Files
| Name | Type | Format | Downloadable | Uploaded By |
|---|---|---|---|---|
| Full_Body_Muscular.glb | 3D Model | .glb | Yes | Teacher |
| Heart_Cross_Section.obj | 3D Model | .obj | Yes | Teacher |
| Muscle_Contraction_Explained.mp4 | Video | .mp4 | No | Teacher |
| Respiratory_Labels.json | Metadata | .json | No | Teacher |
| PT_Shoulder_Lecture_Notes.pdf | Learning Material | .pdf | Yes | Teacher |
| Anatomy Reference Portal | Other Link | URL | No | Teacher |

---

## 11. Minimum Viable Product

The MVP must satisfy the following, mapped directly to FR priority:

| # | MVP Requirement | FR Reference |
|---|---|---|
| 1 | Login and logout with username/password | FR-26, FR-27 |
| 2 | All content restricted to authenticated users | FR-28 |
| 3 | Student access to all five platform sections | FR-1 |
| 4 | 3D model viewer with zoom, rotate, pan, reset | FR-6, FR-7, FR-11 |
| 5 | Browse models by body system and body part | FR-3, FR-4 |
| 6 | Clickable labels showing name and description | FR-8, FR-9, FR-21 |
| 7 | Linked video plays when label is selected | FR-13, FR-22 |
| 8 | Separate animated video section with all videos | FR-14 |
| 9 | MCQ and practical quiz attempts with score display | FR-15, FR-16 |
| 10 | Quiz attempt history for students | FR-17, FR-18 |
| 11 | Teacher upload of models, videos, and labels | FR-30, FR-35, FR-36 |
| 12 | Teacher label placement and editing on model | FR-37, FR-38, FR-39 |
| 13 | Teacher links label to video | FR-40 |
| 14 | Teacher creates and edits quiz questions | FR-42 |
| 15 | Teacher manages content visibility | FR-44 |
| 16 | Download restricted by teacher permission | FR-19, FR-20, FR-46 |
| 17 | Learning materials accessible by programme | FR-23, FR-24 |
| 18 | Role-based access control enforced throughout | NFR-11, NFR-12 |
| 19 | Consistent layout and navigation across all pages | NFR-2 |
| 20 | Supported on Chrome, Edge, Firefox, Safari | NFR-17 |

---

## 12. Out of Scope (Current Phase)

The following are noted for future phases and are not required for the initial build:

- Live cloud storage integration (FR-50, FR-51, FR-CS-1, FR-CS-2) — architecture must support it but implementation is deferred
- Sketchfab direct API migration automation — manual import of files is acceptable initially
- Mobile layout optimisation beyond basic responsiveness
- Advanced quiz analytics and reporting dashboards
- Real-time collaboration between teachers
- Email-based password reset
