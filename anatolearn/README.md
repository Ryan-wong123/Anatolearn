# AnatoLearn

## Automated testing

The project uses Vitest and React Testing Library for components, Supertest and Vitest for the Express API, and Playwright for browser workflows. Install dependencies in both `anatolearn` and `anatolearn/backend` with `npm install`.

Use a dedicated PostgreSQL database. Its name must contain `test`; the setup command refuses any other target:

```bash
export TEST_DATABASE_URL=postgres://anatolearn:anatolearn@localhost:5432/anatolearn_test
npm run test:db:setup
```

The setup command reapplies migrations `001_schema.sql` through `006_add_video_annotation_link.sql`, applies `002_seed.sql` in sequence, and then loads deterministic test-only users from `backend/test/fixtures.sql`. Re-running it resets test records, so it must never be pointed at development or production data.

Available commands are:

- `npm test` — run frontend tests once.
- `npm run test:watch` — run frontend tests in watch mode.
- `npm run test:coverage` — run frontend tests with HTML/text coverage and fail below 70%.
- `npm run test:backend` — run isolated API contract tests.
- `npm run test:e2e` — run Playwright browser workflows.

Before the first browser run, install Chromium with `npx playwright install chromium`. Playwright starts Vite automatically. API-focused browser scenarios should use deterministic seeded data or explicit route mocks and clean up any uploads they create.

Covered contracts include authentication rejection and redirects, quiz scoring/input ownership and answer confidentiality, annotation validation and teacher ownership, model/video loading and downloads, and linked video navigation. The 70% threshold is intentionally enforced on the focused frontend units introduced by this testing baseline and should expand with future suites.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
