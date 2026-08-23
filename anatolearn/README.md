# AnatoLearn

AnatoLearn is a React/Vite learning client with an Express and PostgreSQL API.

## Automated testing

Install dependencies in both `anatolearn` and `anatolearn/backend` with `npm install`. The frontend suite uses Vitest, React Testing Library, and browser API mocks. The API integration suite uses Vitest and Supertest. Browser workflows use Playwright; install Chromium once with `npx playwright install chromium`.

The API suite intentionally refuses to start unless `TEST_DATABASE_URL` is present and its database name contains `test`. Create a dedicated empty database, then run:

```bash
TEST_DATABASE_URL=postgres://user:password@localhost:5432/anatolearn_test npm run test:backend
```

The harness applies migrations `001_schema.sql` through `006_add_video_annotation_link.sql` in order, creates deterministic fixtures, and truncates application records after the run. Never point this variable at development or production. Uploaded test media should use a temporary `PUBLIC_DIR`; rejected-upload fixtures do not persist files.

Available commands are `npm test` (frontend once), `npm run test:watch`, `npm run test:coverage`, `npm run test:backend`, and `npm run test:e2e`. Backend coverage is available from `anatolearn/backend` through `npm run test:coverage`. Both coverage configurations enforce a 70 percent minimum. Playwright starts Vite automatically and uses mocked API boundaries for deterministic browser flows.

Coverage includes protected routing, media loading and failure states, projected-mask edge cases, API authentication and role enforcement, quiz confidentiality/scoring/ownership, annotation validation, listing/missing records, and upload rejection.

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
