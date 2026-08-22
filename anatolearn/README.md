# AnatoLearn

AnatoLearn is a React/Vite anatomy learning application backed by an Express and PostgreSQL API.

## Automated testing

Install frontend and backend dependencies with `npm ci` and `npm --prefix backend ci`. The test stack uses Vitest, React Testing Library, Supertest, and Playwright. Browser tests require Chromium, installed once with `npx playwright install chromium`.

The backend suite will only run when `TEST_DATABASE_URL` names a separate PostgreSQL database whose database name contains `test`. It refuses an ordinary development or production database. For example:

```bash
createdb anatolearn_test
export TEST_DATABASE_URL=postgresql://anatolearn:password@localhost:5432/anatolearn_test
export JWT_SECRET=anatolearn-test-only-secret
npm run test:backend
```

The backend harness applies `001_schema.sql` through `006_add_video_annotation_link.sql` in filename order before the suite. Each test creates deterministic users and truncates mutable fixture tables before running; uploaded files are directed to a test-only directory and removed at suite completion.

Available commands are:

- `npm test` — frontend component and utility tests once
- `npm run test:watch` — frontend watch mode
- `npm run test:coverage` — frontend coverage with a 70% enforced threshold
- `npm run test:backend` — isolated PostgreSQL/Supertest integration tests
- `npm --prefix backend run test:coverage` — backend coverage with a 70% enforced threshold
- `npm run test:e2e` — Playwright critical browser workflows
- `npm run lint` and `npm run build` — static validation and TypeScript/build checks

The automated workflows cover protected access, registration and authentication failures, JWT rejection, role enforcement, quiz confidentiality/scoring/ownership, annotation validation and mutation, listing/missing records, upload rejection, and browser navigation. See `docs/testing_log.md` for scope, fixture, cleanup, and execution records.

## Vite reference

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
