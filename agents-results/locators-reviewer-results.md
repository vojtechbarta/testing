# Locator review log

Append dated sections here after each Playwright locator review (see `.cursor/skills/playwright-locator-review/SKILL.md`).

## 2026-04-13 — Admin E2E (`admin.page.ts`, `admin.spec.ts`)

**Files touched:** `frontend/e2e/pages/admin.page.ts`, `frontend/e2e/tests/admin.spec.ts`

**Findings:**

- **Admin login form** — `input[name="username"]` / `input[name="password"]`: no `data-testid` on admin UI (unlike shop). Acceptable for now; consider `data-testid` on admin form fields if copy/layout changes.
- **“Last row” after add** — `.data-table tbody tr` **last()** relies on default admin sort (**id ascending**). If sort UI or default changes, this breaks; document or assert sort, or target the new row by API-returned id once exposed in DOM (first `td`).
- **Row actions** — `getByRole("button", { name: "Save" })` scoped to the product row is stable; unscoped would match every row.
- **Assertion** — Avoided `page.getByDisplayValue` (not on `Page` in current `@playwright/test`). Used `expect(row.getByRole("textbox").first()).toHaveValue(name)` instead.
