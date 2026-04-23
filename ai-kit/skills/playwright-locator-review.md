# Playwright locator review (this project)

## Scope

- `frontend/e2e/tests/*.spec.ts`
- `frontend/e2e/pages/*.ts`
- Related UI under `frontend/src/` (especially `data-testid` usage)

## Process

1. Identify new/changed locators in specs and page objects.
2. Compare with app conventions (`data-testid` in components, e.g. `frontend/src/App.tsx`).
3. Prefer resilient locator strategies:
   - stable test ids
   - role/name where appropriate
   - avoid deep CSS/layout-only selectors unless documented

## Marking locators in code

- Risky locator comment:
  - `// ! Unstable locator - <reason>`
- After fixing locator:
  - `// ! Fixed locator - <reason>`

## Review log

Append each review pass to:

- `agents-results/locators-reviewer-results.md`

Include:

- Date
- Files touched
- Findings, decisions, and fixes

## Notes

- Use with `skills/playwright-ui-automation.md`.
- This guide is not an automatic hook; run explicitly when needed.
