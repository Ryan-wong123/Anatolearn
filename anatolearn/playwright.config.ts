import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    // The application currently hard-codes its API origin to localhost:5000.
    // Route-mocked tests disable browser CORS enforcement so no real API or
    // development database can be contacted.
    launchOptions: { args: ['--disable-web-security'] },
  },
  webServer: { command: 'VITE_API_BASE=/api npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
