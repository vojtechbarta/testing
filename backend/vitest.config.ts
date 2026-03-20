import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 15_000,
    /** Keep integration-style API tests in a dedicated file pattern if you want to split later. */
    include: ["src/**/*.test.ts"],
  },
});
