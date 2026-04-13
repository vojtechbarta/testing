---
name: playwright-ui-automation
description: >-
  Authors and maintains Playwright UI/E2E tests in this monorepo: e2e specs, page
  objects, playwright.config, npm run test:e2e, seed alignment, flaky tests.
  Use when adding or fixing automated UI tests, shop flows, shop.spec.ts, e2e/pages,
  PLAYWRIGHT_BASE_URL, or when the user mentions Playwright automation at UI level.
  For a dedicated locator audit after substantive changes, use the playwright-locator-review skill.
---

# Playwright UI automation (this project)

## Layout

| Area | Path |
|------|------|
| Config | [`frontend/playwright.config.ts`](../../../frontend/playwright.config.ts) |
| Specs | [`frontend/e2e/tests/*.spec.ts`](../../../frontend/e2e/tests/) |
| Page objects | [`frontend/e2e/pages/*.ts`](../../../frontend/e2e/pages/) |
| Deep dive | [`frontend/e2e/README.md`](../../../frontend/e2e/README.md) |

`playwright.config.ts` uses `testDir: ./e2e/tests`, default `baseURL` `http://localhost:5173`, Chromium only. Unless `SKIP_WEBSERVER=1`, `webServer` runs `npm run dev:e2e` (backend + Vite). Override URL with `PLAYWRIGHT_BASE_URL`.

## Commands (from `frontend/`)

```bash
npm run test:e2e           # headless; may start dev:e2e
npm run test:e2e:headed    # visible browser
npm run test:e2e:ui        # Playwright UI
npm run test:e2e:report    # last HTML report
SKIP_WEBSERVER=1 npm run test:e2e   # servers already on :4000 / :5173
```

First-time browsers: `npx playwright install chromium` (see e2e README).

## Project rules

1. **Seed sync** — Product names and prices in tests must match [`backend/prisma/seed.ts`](../../../backend/prisma/seed.ts). Export shared constants from page objects when useful (see `SEED_PRODUCTS` in [`shop.page.ts`](../../../frontend/e2e/pages/shop.page.ts)).
2. **CORS** — `baseURL` must be allowed in backend `FRONTEND_DEV_ORIGINS` (`localhost` vs `127.0.0.1` must stay consistent).
3. **Database** — Run migrations + seed so the catalog matches what tests expect.

## Page Object pattern

Follow [`shop.page.ts`](../../../frontend/e2e/pages/shop.page.ts):

- Class per main view (e.g. `ShopPage`), `constructor(private readonly page: Page)`.
- `goto()`, named locators (`productCardByName`, …), and async helpers that call `expect`.
- Specs stay thin: instantiate the page object, call helpers, keep scenario readable.

## Authoring new UI tests

- Identify key elements in the app; prefer **stable** locators aligned with the UI (e.g. `data-testid` where the app exposes it), then Playwright’s role/text locators when they improve clarity and resilience.
- After finishing a new spec or a non-trivial locator change, run a **locator review** using the [`playwright-locator-review`](../playwright-locator-review/SKILL.md) skill (or ask the user to trigger it).

## Waits and timing

- Rely on Playwright **auto-wait** and web-first assertions (e.g. `expect(locator).toBeVisible()`).
- Avoid fixed `page.waitForTimeout()` except rare cases (animations, known delays); prefer waiting on a concrete state.

## When a test fails

[`playwright.config.ts`](../../../frontend/playwright.config.ts) uses `screenshot: only-on-failure` (full page) and `trace: retain-on-failure`. Inspect:

- HTML report: `frontend/playwright-report/`
- Raw runs: `frontend/test-results/`

Use `npm run test:e2e:report` from `frontend/` to open the last HTML report.

## Pitfalls

**Fault injection** (cart / checkout API, UI, or unit-level faults) can change app behavior. For stable regression E2E, keep faults off or align expectations with the active training scenario and document that in the spec.
