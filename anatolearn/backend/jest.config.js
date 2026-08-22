module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/__tests__/env.js"],
  globalSetup: "<rootDir>/src/__tests__/globalSetup.js",
  globalTeardown: "<rootDir>/src/__tests__/globalTeardown.js",
  testTimeout: 30000,
  collectCoverageFrom: ["src/server.js"],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
