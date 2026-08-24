import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/test/**/*.test.js'],
    setupFiles: ['backend/test/setup.js'],
    pool: 'forks',
    fileParallelism: false,
  },
});
