import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 15_000,
    /**
     * - `src/integration-tests/` — HTTP + DB (internal API contract)
     * - `src/services/unit-tests/` — isolated service logic (mocks)
     */
    include: ["src/**/*.test.ts"],
  },
});
