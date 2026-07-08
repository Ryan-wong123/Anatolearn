# AnatoLearn

A web-based interactive 3D anatomy learning platform for health science education, developed for SIT's Health and Social Sciences Cluster (ITP Team SE_12).

## Overview

AnatoLearn lets students explore labelled 3D anatomical models directly in the browser, watch linked educational videos, and test their knowledge with self-assessment quizzes. Teachers can upload models, place and manage anatomical labels, link videos to specific structures, and build quizzes — all through a role-gated interface (Student / Teacher).

## Team

| Name | Role | Responsibility |
|---|---|---|
| Wong Hoi Young Ryan | Member A | Frontend, 3D model rendering, interaction controls, label visualisation, video playback |
| Timothy Jeremy Tay | Member B | Backend APIs, authentication, database, metadata handling, system integration |
| Natalie Chia Shuxian | Member C | Content management, educational video management, quiz implementation, content testing |
| Thian Yu Xuan Raynard | Member D | Download/export support, metadata export, storage architecture, compatibility testing |

**Industry Supervisor:** Dr. Suresh (SIT, Health and Social Sciences Cluster)
**Academic Supervisor:** Nisha Jain

## Tech Stack

- **Frontend:** React 19 + TypeScript, built with Vite
- **Styling:** Tailwind CSS (custom fonts: DM Sans for display text, IBM Plex Sans for body text)
- **Routing:** react-router-dom v7
- **3D Rendering:** Three.js (see rationale below)
- **Icons:** lucide-react
- **Backend:** *(to be documented once implemented — see Task 1.3)*

## Getting Started (Local Setup)

### Prerequisites
- Node.js (LTS recommended)
- npm
- Docker Desktop, for the full frontend/backend/PostgreSQL stack

### Installation

```bash
# from the repo root
cd anatolearn

# install dependencies
npm install

# start the local dev server
npm run dev
```

The app will be available at the URL Vite prints in the terminal (typically `http://localhost:5173/`).

### Full Docker setup

```bash
# from the repo root
cd anatolearn

# build and start frontend, backend, and PostgreSQL
docker compose up --build
```

The PostgreSQL service creates the `anatolearn` database automatically and runs the SQL scripts in `backend/sql` on first startup:

- `001_schema.sql`
- `002_seed.sql`

These scripts are mounted read-only into `/docker-entrypoint-initdb.d`, which the official PostgreSQL image runs only when the database volume is empty. If a local `postgres_data` volume already exists, Docker keeps the existing database and does not rerun the init scripts. For a clean development reset:

```bash
docker compose down -v
docker compose up --build
```

Only use the volume reset command when local database contents can be deleted.

### Other useful commands

```bash
npm run build     # type-checks and builds a production bundle
npm run preview   # locally preview the production build
npm run lint      # run ESLint
```

## Framework Decisions

### 3D Rendering: Three.js



## Project Structure

```
anatolearn/
├── src/
│   ├── assets/          # Static assets (images, etc.)
│   ├── components/     # Shared components (Layout, ProtectedRoute, etc.)
│   ├── context/         # React context (AppContext — role/program state)
│   ├── pages/           # Route-level pages (Dashboard, Viewer, Videos, Quizzes, Library, Login, Register)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── docs/                # Project documentation (this folder)
├── public/
└── package.json
```

## Documentation Index

- [`database_schema.md`](./database_schema.md)  — database schema (pending, see Task 1.2)
- [`storage_structure.md`](./storage_structure.md)  — file storage structure and formats (pending, see Task 1.4)
- [`api_endpoints.md`](./api_endpoints.md) — API route reference *(pending, see Task 1.3)*
- [`testing_log.md`](./testing_log.md)  — browser/compatibility test records
- [`3d_model_tools.md`](./3d_model_tools.md) — 3D model generation tooling notes *(pending, see Objective 6 / shared responsibility: sourcing open-source 3D model generation software)*
