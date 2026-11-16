import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Runs once before all tests: brings the test database schema up to date
    globalSetup: ["./tests/setup/global-setup.js"],
    // Runs in each test file before its imports: points the app at the test database
    setupFiles: ["./tests/setup/env.js"],
    // All test files share one database, so run them one at a time
    fileParallelism: false,
  },
});
