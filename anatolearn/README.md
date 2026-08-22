# AnatoLearn

AnatoLearn is a React/Vite anatomy-learning frontend with an Express and PostgreSQL API.

## Automated testing

Install frontend and backend dependencies with `npm install` in both `anatolearn/` and `anatolearn/backend/`. The suite uses Vitest, React Testing Library, Supertest, and Playwright.

Backend integration tests require a dedicated PostgreSQL database. Create a database whose name contains `test`, then set `TEST_DATABASE_URL`; the harness rejects a URL without `test` in the database name and rejects any URL equal to `DATABASE_URL`. At suite startup, migrations `001_schema.sql` through `006_add_video_annotation_link.sql` are applied in filename order. Each test truncates mutable tables and inserts deterministic fixtures.

```bash
npm test                 # frontend component tests
npm run test:watch       # frontend watch mode
npm run test:coverage    # frontend tests with 70% coverage gates
npm run test:backend     # isolated PostgreSQL/Supertest suite
npx playwright install chromium
npm run test:e2e         # critical Chromium workflows
```

Playwright starts Vite automatically. Its deterministic browser specifications mock the HTTP boundary; integration with the real API remains covered by the backend suite. The initial coverage gate applies to the fully exercised `VideoPlayer` state component while the remaining critical tests still run as regression checks. Generated HTML reports and coverage files are ignored build artifacts and should not be committed.

The tested scope includes protected routing, registration and login, token and role enforcement, quiz answer confidentiality/scoring/ownership, annotation validation and mutations, projected-mask edge cases, video loading/error handling, model/video empty and missing states, upload rejection, and critical browser navigation.

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
