# AnatoLearn

AnatoLearn is a React/Vite anatomy-learning application backed by an Express API and PostgreSQL. Node.js 20 or later and PostgreSQL are required for local development.

## Installation and development

Install dependencies with `npm install` and `npm --prefix backend install`. Run the frontend with `npm run dev` and the API with `npm --prefix backend run dev`. The API requires `DATABASE_URL` and `JWT_SECRET`.

## Automated testing

The frontend uses Vitest and React Testing Library, API checks use Vitest and Supertest, and browser workflows use Playwright.

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:backend
npm run test:e2e
```

Install Chromium once with `npx playwright install chromium`. End-to-end runs require the API and isolated test database; Playwright starts Vite automatically.

## Isolated test database

Create a PostgreSQL database whose name contains a standalone `test` segment. Never target development or production data.

```bash
export TEST_DATABASE_URL=postgresql://user:password@localhost:5432/anatolearn_test
npm --prefix backend run test:db:migrate
npm run test:backend
```

The migration command refuses unsafe names and applies migrations 001 through 006 in order. Fixtures use fixed values and cleanup hooks; upload tests must set `PUBLIC_DIR` to a temporary directory and remove it afterward. Coverage fails below 70 percent for lines, functions, branches, or statements.
