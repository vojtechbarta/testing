# Playwright E2E

## Prerequisites

- MySQL running with `DATABASE_URL` in `backend/.env` (migrate + **seed** so the three default products exist).
- Or start backend + frontend yourself and set **`SKIP_WEBSERVER=1`** when running tests.

## Commands (from `frontend/`)

```bash
npm run test:e2e          # headless; starts backend + Vite via dev:e2e unless ports already in use (non-CI)
npm run test:e2e:ui      # interactive UI mode
npm run test:e2e:headed  # headed browser
SKIP_WEBSERVER=1 npm run test:e2e   # only run tests (you already have :4000 and :5173 up)
npm run test:e2e:report  # open last HTML report (screenshots + traces on failure)
```

On failure locally, the HTML report usually **opens automatically** (`open: on-failure`). You’ll see **Expected / Received**, **screenshot** (full page), and **trace** for the failed test.

Artifacts: `playwright-report/`, `test-results/`.

First time only (if browsers are missing):

```bash
npx playwright install chromium
```

## CORS / URL

The API allows `http://localhost:5173` and `http://127.0.0.1:5173`. Tests use **localhost** by default. Override with `PLAYWRIGHT_BASE_URL` if needed.

## Layout

- **`e2e/pages/`** — Page objects (`shop.page.ts`).
- **`e2e/tests/`** — Spec files (`*.spec.ts`).

Product names and prices in tests must stay in sync with `backend/prisma/seed.ts`.
