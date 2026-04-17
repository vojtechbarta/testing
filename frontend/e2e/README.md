# Playwright E2E

## Prerequisites

- MySQL running with `DATABASE_URL` in `backend/.env` (migrate + **seed** so the default catalog matches [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts), e.g. 15 products).
- Or start backend + frontend yourself and set **`SKIP_WEBSERVER=1`** when running tests.

## Commands (from `frontend/`)

```bash
npm run test:e2e          # headless; starts backend + Vite via dev:e2e unless ports already in use (non-CI)
npm run test:e2e:chromium # full regression on Chromium only
npm run test:e2e:smoke    # cross-browser smoke subset (Firefox + WebKit)
npm run test:e2e:ui      # interactive UI mode
npm run test:e2e:headed  # headed browser
SKIP_WEBSERVER=1 npm run test:e2e   # only run tests (you already have :4000 and :5173 up)
npm run test:e2e:report  # open last HTML report (screenshots + traces on failure)
```

On failure locally, the HTML report usually **opens automatically** (`open: on-failure`). You’ll see **Expected / Received**, **screenshot** (full page), and **trace** for the failed test.

Artifacts: `playwright-report/`, `test-results/`.

`test:e2e`, `test:e2e:chromium`, and `test:e2e:smoke` reseed backend data before execution (`npm run prisma:seed --prefix ../backend`) to keep stock/cart-sensitive flows deterministic.

First time only (if browsers are missing):

```bash
npx playwright install chromium firefox webkit
```

## CORS / URL

The API allows `http://localhost:5173` and `http://127.0.0.1:5173`. Tests use **localhost** by default. Override with `PLAYWRIGHT_BASE_URL` if needed.

## Layout

- **`e2e/pages/`** — Page objects (`shop.page.ts`).
- **`e2e/tests/`** — Spec files (`*.spec.ts`).

## Cross-browser smoke convention

- Tests tagged with `@smoke` in the test title are eligible for cross-browser smoke runs.
- `npm run test:e2e` runs:
  - full suite on Chromium
  - only `@smoke` tests on Firefox/WebKit
- Keep smoke tests short, stable, and representative of critical user paths (shop/admin/tester/checkout).

Product names in tests must match `backend/prisma/seed.ts` (English `name` as returned by the API for `lang=en`). **Exact cart/catalog amounts and CZK→EUR math** are covered by **backend integration tests** (`GET /products`, `GET /cart`); Playwright shop tests only check **UI**: grid, images, add-to-cart, quantity, and that money labels show **€** in the default English storefront.

Product card **images** must live under **`frontend/public/catalog/`** (URLs `/catalog/…`) so they are not caught by the Vite dev proxy for the **`/products`** API. `shop.spec.ts` asserts `naturalWidth > 0` on those images.

## UI language

The app defaults to **English** (`i18n` initial language + `localStorage` key `i18nextLng`). Playwright specs assume **English** UI (nav labels, product titles from API, etc.). If you switch to Czech in the browser, assertions that match visible product titles would need the Czech strings from `frontend/src/locales/cs.json` (`products.byId.*`). Language switcher: `data-testid="lang-switch-en"` / `lang-switch-cs`.
