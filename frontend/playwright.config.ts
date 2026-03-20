import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests assume seeded DB (three products: Test Mouse, Test Keyboard, QA Monitor).
 * `webServer` starts backend, waits for /health, then Vite (see package.json `dev:e2e`).
 * Set SKIP_WEBSERVER=1 if you already run both servers manually.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: process.env.CI ? "never" : "on-failure",
        outputFolder: "playwright-report",
      },
    ],
  ],
  use: {
    /* Must match an entry in backend `FRONTEND_DEV_ORIGINS` (CORS). */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    /* Full-page screenshot + trace on failure appear under test-results/ and in HTML report. */
    screenshot: { mode: "only-on-failure", fullPage: true },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(process.env.SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: "npm run dev:e2e",
          url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
