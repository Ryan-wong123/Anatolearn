const js = require('@eslint/js');
const globals = require('globals');
const security = require('eslint-plugin-security');

// `npm run lint` fails on warnings too (--max-warnings 0), so every security finding has to be fixed or consciously
// silenced with a comment that says why it is safe.
module.exports = [
  { ignores: ['node_modules'] },
  js.configs.recommended,
  security.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: {
      // Service functions share one (input) signature, and `({ secret, ...rest })` is how fields are dropped on purpose.
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
      // Fires on every obj[key] (hundreds of false positives), so it hides real findings. Request-derived keys are
      // validated against allowlists instead (see catalog.repository.js contentTable and favorites.repository.js).
      'security/detect-object-injection': 'off',
    },
  },
  {
    // The only modules that build file paths at run time. Every path comes from a server-generated UUID file name,
    // storage.resolveAsset() (which rejects anything outside the storage root), storage.objectKey() or the migrations directory;
    // never from raw input.
    files: ['src/storage.js', 'src/scan.js', 'src/migrate.js', 'src/middleware/uploads.js'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
  {
    // Test and one-off script code works on temp files it creates itself.
    files: ['tests/**/*.js', 'scripts/**/*.js'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
];
