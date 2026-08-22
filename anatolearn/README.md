# AnatoLearn

AnatoLearn is a React/Vite anatomy-learning frontend with an Express and PostgreSQL API. The automated verification stack uses Vitest, React Testing Library, Supertest/Jest, and Playwright.

## Test installation and commands

Install both dependency sets before testing:

```sh
npm install
npm --prefix backend install
npx playwright install chromium
```

Run the standard frontend suite with `npm test`, watch mode with `npm run test:watch`, and enforced frontend coverage with `npm run test:coverage`. Run API integration tests with `npm run test:backend`; backend coverage is available from `npm --prefix backend run test:coverage`. Run critical browser workflows with `npm run test:e2e`. Production validation also includes `npm run lint` and `npm run build`.

## Isolated PostgreSQL test database

API tests require an empty, local database whose name contains `test`. The harness refuses a non-local URL, a database without the test marker, or a URL equal to `DATABASE_URL` unless the explicit `ALLOW_TEST_DATABASE_RESET=true` override is supplied.

```sh
createdb anatolearn_test
TEST_DATABASE_URL=postgresql://localhost/anatolearn_test npm run test:backend
```

The harness applies migrations `001_schema.sql` through `006_add_video_annotation_link.sql` in filename order, loads the deterministic migration seed, inserts per-suite fixtures, truncates test records, and removes its temporary upload directory after execution. It never reads development fixtures.

## Coverage and browser policy

Frontend and backend coverage configurations enforce 70 percent minimum line, statement, function, and branch coverage. Playwright uses Chromium by default; install its managed browser before the first E2E run. The browser suite verifies protected access and login, quiz completion, model browsing, and video navigation. API coverage additionally verifies registration/login failures, token and role enforcement, quiz scoring and attempt ownership, answer confidentiality, annotation validation and CRUD authorization, missing records, listings, and invalid media rejection.
