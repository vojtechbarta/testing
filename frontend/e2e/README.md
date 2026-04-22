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

## Deployed environment (Azure / CI agent)

Use this when the SPA and API are already running (for example Azure Static Web Apps + Container Apps). Do **not** use `npm run test:e2e` here—it runs **local** `prisma:seed`; rely on your deployed DB state or seed via [`.github/workflows/azure-seed.yml`](../../.github/workflows/azure-seed.yml).

Required:

- **`SKIP_WEBSERVER=1`** — do not start `dev:e2e`; drive the browser against the live site.
- **`PLAYWRIGHT_BASE_URL`** — deployed storefront origin (same URL users open).
- **`PLAYWRIGHT_API_BASE_URL`** — public API base URL ([`e2e/helpers/adminApi.ts`](helpers/adminApi.ts)); production API must allow your SPA origin via **`CORS_ORIGINS`** on the backend.

Example:

```bash
export CI=true
export SKIP_WEBSERVER=1
export PLAYWRIGHT_BASE_URL=https://your-app.azurestaticapps.net
export PLAYWRIGHT_API_BASE_URL=https://your-api.example.azurecontainerapps.io
cd frontend && npm ci && npx playwright install chromium && npm run test:e2e:deployed -- --project=chromium
```

Azure DevOps: see [`azure-pipelines.yml`](../../azure-pipelines.yml) at the repo root (JUnit + artifacts). Set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_API_BASE_URL` as pipeline variables.

## Layout

- **`e2e/pages/`** — Page objects (`shop.page.ts`).
- **`e2e/tests/`** — Spec files (`*.spec.ts`).

## Cross-browser smoke convention

- Tests tagged with `@smoke` in the test title are eligible for cross-browser smoke runs.
- `npm run test:e2e` runs:
  - full suite on Chromium
  - only `@smoke` tests on Firefox/WebKit
- Keep smoke tests short, stable, and representative of critical user paths (shop/admin/tester/checkout).

Product names in tests must match `backend/prisma/seed.ts` (English `name` as returned by the API for `lang=en`). **Exact cart/catalog amounts and locale conversion math** are covered by **backend integration tests** (`GET /products`, `GET /cart`); Playwright shop tests only check **UI**: grid, images, add-to-cart, quantity, and that money labels show **€** in the default English storefront.

Product card **images** must live under **`frontend/public/catalog/`** (URLs `/catalog/…`) so they are not caught by the Vite dev proxy for the **`/products`** API. `shop.spec.ts` asserts `naturalWidth > 0` on those images.

## UI language

The app defaults to **English** (`i18n` initial language + `localStorage` key `i18nextLng`). Playwright specs assume **English** UI (nav labels, product titles from API, etc.). If you switch to Czech in the browser, assertions that match visible product titles would need the Czech strings from `frontend/src/locales/cs.json` (`products.byId.*`). Language switcher: `data-testid="lang-switch-en"` / `lang-switch-cs`.

## Locator audit cycle

Run a locator audit when any of the following changes:

- `frontend/e2e/tests/*.spec.ts` (see also `locator-audit-demo-bad-patterns.spec.ts` for **intentionally wrong** examples used in audit training PRs)
- `frontend/e2e/pages/*.ts`
- Related UI elements in `frontend/src/` that test locators target

### Required process

Follow the project skill at `.cursor/skills/playwright-locator-review/SKILL.md`:

1. Identify changed/new locators in specs and page objects.
2. Check whether matching `data-testid` exists in targeted UI components.
3. Prefer resilient locators in this order: `data-testid` -> role/name -> constrained text.
4. Flag fragile selectors inline when needed:
   - `// ! Unstable locator - <reason>`
5. Mark fixed/replaced selectors inline:
   - `// ! Fixed locator - <reason>`
6. Append review output to `agents-results/locators-reviewer-results.md` with date, files touched, findings, and decisions.

### Severity rubric and merge gates

- **High risk**
  - Deep CSS or layout-only selectors (`nth-child`, chained descendants tied to structure).
  - Ambiguous locators that can match multiple elements in normal UI states.
  - **Merge gate**: unresolved High findings block merge.
- **Medium risk**
  - i18n-fragile text locators or role locators lacking enough disambiguation in repeated UI.
  - **Merge gate**: allowed only with explicit follow-up action recorded in PR notes.
- **Low risk**
  - Stable selector that can be improved for clarity/maintainability.
  - **Merge gate**: allowed; track as cleanup when practical.

### Definition of done

A Playwright locator change is done only when:

- locator audit has been executed,
- any High findings are fixed before merge,
- latest review entry is appended to `agents-results/locators-reviewer-results.md`,
- unresolved Medium/Low findings have explicit follow-up notes.
