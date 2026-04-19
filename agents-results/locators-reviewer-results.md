# Locator review log

Append dated sections here after each Playwright locator review (see `.cursor/skills/playwright-locator-review/SKILL.md`).

## 2026-04-13 — Admin E2E (`admin.page.ts`, `admin.spec.ts`)

**Files touched:** `frontend/e2e/pages/admin.page.ts`, `frontend/e2e/tests/admin.spec.ts`

**Findings:**

- **Admin login form** — `input[name="username"]` / `input[name="password"]`: no `data-testid` on admin UI (unlike shop). Acceptable for now; consider `data-testid` on admin form fields if copy/layout changes.
- **“Last row” after add** — `.data-table tbody tr` **last()** relies on default admin sort (**id ascending**). If sort UI or default changes, this breaks; document or assert sort, or target the new row by API-returned id once exposed in DOM (first `td`).
- **Row actions** — `getByRole("button", { name: "Save" })` scoped to the product row is stable; unscoped would match every row.
- **Assertion** — Avoided `page.getByDisplayValue` (not on `Page` in current `@playwright/test`). Used `expect(row.getByRole("textbox").first()).toHaveValue(name)` instead.

## 2026-04-17 — Pilot locator audit cycle (`admin.page.ts`, `admin.spec.ts`)

**Files touched:** `frontend/e2e/pages/admin.page.ts`, `frontend/e2e/tests/admin.spec.ts`

**Findings:**

- **Stable** — Row-scoped role locators are used for the mutable admin table (`row.getByRole("textbox").first()`, `row.getByRole("button", { name: "Save" })`), which keeps repeated controls disambiguated.
- **Medium risk** — Login selectors still use `input[name="username"]` and `input[name="password"]`; this is acceptable now, but remains coupled to form field naming. Consider `data-testid` on admin credentials inputs when admin UI updates.
- **Medium risk** — Table row targeting depends on `.data-table tbody tr` with first-cell filtering. This is resilient enough for current markup, but still tied to table structure/classes; adding row-level test ids would further harden it.
- **Decision** — No code locator change required in this pilot pass. Existing selectors are acceptable and documented for follow-up hardening when admin UI evolves.

## 2026-04-17 — Locator audit demo file (`locator-audit-demo-bad-patterns.spec.ts`)

**Files touched:** `frontend/e2e/tests/locator-audit-demo-bad-patterns.spec.ts`

**Findings:**

- **High** — `main > div > div:nth-child(2) > button`: deep descendant + `nth-child` tied to layout, not roles or test ids.
- **High** — `getByText("Login")` without scoping: ambiguous if multiple nodes contain that substring.
- **High** — `xpath=//*[contains(@class,'button')]` + `.first()`: class substring matching is fragile and order-dependent.
- **High** — `section .product-grid .product-card:nth-of-type(1) button`: structural chain + `nth-of-type`; breaks when grid order or markup changes.
- **Decision** — File is `test.describe.skip` on purpose so CI does not run these tests. **Do not merge** with `.skip` removed unless locators are rewritten to the project standard (`data-testid` / role+name). Training PR only: either delete this spec after the exercise or replace with stable patterns.

## 2026-04-19 — Volume discount promo (`shop.spec.ts`)

**Files touched:** `frontend/e2e/tests/shop.spec.ts`, cart/checkout UI in `frontend/src/App.tsx`

**Findings:**

- **Stable** — Promo strip uses `data-testid="shop-discount-promo"`; cart promo uses `cart-promo-input`, `cart-promo-apply`, `cart-promo-clear`, `cart-subtotal`, `cart-discount-amount`, `cart-estimated-total`.
- **Stable** — Checkout preview uses `checkout-order-preview`, gateway due amount `checkout-gateway-due`.
- **Low risk** — Banner assertion uses `toContainText("MoreIsLess")` plus visible promo container; acceptable for marketing copy.
