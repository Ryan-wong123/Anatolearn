import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Self-contained browser tests: starts its own backend and Vite server, so it needs only a Postgres database
// (DATABASE_URL, as for the backend tests) and a Chromium. It does not touch the Docker development app.
// Set E2E_CHROMIUM_PATH to use a Chromium that is already installed.
const BACKEND_PORT = 5055, FRONTEND_PORT = 5174;
const databaseUrl = process.env.DATABASE_URL || 'postgres://anatolearn:password@localhost:5432/anatolearn';
const jwtSecret = process.env.JWT_SECRET || 'e2e-only-secret-0123456789abcdef0123456789';
process.env.DATABASE_URL = databaseUrl;   // the spec files use the same database through the backend's pool
const publicDir = join(tmpdir(), 'anatolearn-e2e-public');

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'node src/server.js',
      cwd: './backend',
      url: `http://localhost:${BACKEND_PORT}/api/programs`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(BACKEND_PORT), DATABASE_URL: databaseUrl, JWT_SECRET: jwtSecret, PUBLIC_DIR: publicDir,
        FRONTEND_ORIGINS: `http://localhost:${FRONTEND_PORT}`, DISABLE_RATE_LIMIT: 'true', MFA_REQUIRED: 'false',
        TEACHER_INVITE_CODE: 'e2e-invite', NODE_ENV: 'development',
      },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { BACKEND_URL: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
