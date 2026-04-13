---
name: playwright-locator-review
description: >-
  Use after adding or changing Playwright E2E tests or page objects: audit locators,
  flag unstable ones, fix where needed, append findings to agents-results/locators-reviewer-results.md.
  Use when the user asks to review locators, after writing tests, or mentions unstable selectors / data-testid.
---

# Playwright locator review (this project)

## Scope

- [`frontend/e2e/tests/*.spec.ts`](../../../frontend/e2e/tests/)
- [`frontend/e2e/pages/*.ts`](../../../frontend/e2e/pages/)
- Related UI under [`frontend/src/`](../../../frontend/src/) that the test targets (especially `data-testid` usage).

## Process

1. Identify new or changed locators in the spec and page objects.
2. Compare with app conventions: search for `data-testid` in components (e.g. [`frontend/src/App.tsx`](../../../frontend/src/App.tsx)) and prefer matching stable attributes when they exist.
3. Prefer resilient strategies: explicit test ids from the app, then role/name locators where appropriate; avoid brittle deep CSS or layout-only selectors unless documented as unstable.

## Marking locators in code

- **Risky / fragile locator** — add a short comment on that line:
  - `// ! Unstable locator - <reason>`
- **After you change a locator** — add:
  - `// ! Fixed locator - <reason>`

## Log file

Append a new section to [`agents-results/locators-reviewer-results.md`](../../../agents-results/locators-reviewer-results.md) for each review pass:

- **Date** (ISO or human-readable)
- **Files touched** (paths)
- **Findings** — list unstable locators, decisions, and fixes

If the file is empty except the title, start the first entry under a `##` heading with the date.

## Project rules reference

- Seed and CORS expectations for E2E live in [`playwright-ui-automation`](../playwright-ui-automation/SKILL.md).
- If you add repo-wide locator rules later (e.g. under `.github/` or `docs/`), link them here.

## Automation note

Cursor **skills are not hooks**: they do not run automatically on every file save. To run a review after each test change, either ask explicitly (e.g. “review locators”) or configure a **Cursor hook** that runs after edits to `*.spec.ts` / page objects. The hook is separate from this skill.
