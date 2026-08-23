const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: { fileParallelism: false, setupFiles: ['./src/__tests__/setup.js'] },
  coverage: {
    provider: 'v8', reporter: ['text', 'html'], include: ['src/server.js'],
    thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
  },
});
