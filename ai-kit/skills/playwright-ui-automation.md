# Playwright UI automation (this project)

## Purpose

Authors and maintains Playwright UI/E2E tests in this monorepo: e2e specs, page objects, `playwright.config`, test commands, seed alignment, and flakiness handling.

Use when adding/fixing automated UI tests, shop flows, `shop.spec.ts`, `e2e/pages`, `PLAYWRIGHT_BASE_URL`, or when the user mentions Playwright automation at UI level.

## Layout

- Config: `frontend/playwright.config.ts`
- Specs: `frontend/e2e/tests/*.spec.ts`
- Page objects: `frontend/e2e/pages/*.ts`
- Deep dive: `frontend/e2e/README.md`

## Commands (from `frontend/`)

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:report
SKIP_WEBSERVER=1 npm run test:e2e
```

First-time browsers: `npx playwright install chromium` (see e2e README).

## Project rules

1. Seed sync — Product names/prices in tests must match `backend/prisma/seed.ts` (see `SEED_PRODUCTS` in `frontend/e2e/pages/shop.page.ts`).
2. Static product images — Serve from `frontend/public/catalog/` (`/catalog/...`) so Vite `/products` proxy does not intercept PNG requests.
3. CORS — `baseURL` must be allowed by backend origins (`localhost` vs `127.0.0.1` consistency).
4. Database — Migrations + seed must reflect expected catalog.
5. UI language — E2E expects English labels and API product names by default.

## Page Object pattern

- Class per view (`ShopPage` style).
- Expose `goto()`, named locators, and assertion helpers.
- Keep specs thin and readable.

## Locator strategy

- Prefer stable selectors (`data-testid` where available), then role/name locators.
- Avoid brittle deep CSS/layout-only selectors.
- For locator audits, use the companion guide: `skills/playwright-locator-review.md`.

## Waits and timing

- Prefer Playwright auto-wait and web-first assertions.
- Avoid fixed sleeps unless absolutely necessary.

## Failure analysis

`playwright.config.ts` keeps failure screenshots/traces. Check:

- `frontend/playwright-report/`
- `frontend/test-results/`

Open report via `npm run test:e2e:report`.
