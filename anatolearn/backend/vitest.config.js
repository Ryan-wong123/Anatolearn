const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.js'],
    fileParallelism: false,
    setupFiles: ['./src/__tests__/setup.js'],
    globalSetup: ['./src/__tests__/globalSetup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/server.js'],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 70 },
    },
  },
});
