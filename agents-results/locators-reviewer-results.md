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

## 2026-04-19 — Cart promo apply/clear smoke (`shop.spec.ts`, `shop.page.ts`)

**Files touched:** `frontend/e2e/tests/shop.spec.ts`, `frontend/e2e/pages/shop.page.ts`

**Findings:**

- **Stable** — Uses existing `data-testid` hooks: `cart-promo-input`, `cart-promo-apply`, `cart-promo-clear`, `cart-discount-amount`.
- **Low risk** — Quantity bump uses `cart-line-${id}` plus `.cart-qty-btn` **first()** (+ before − in markup). Documented in page object; if button order swaps, adjust to `nth(0)` semantics or add `data-testid` on +/− controls.

## 2026-04-23 — Admin translations modal (`admin.page.ts`, `admin.spec.ts`, `App.tsx`)

**Files touched:** `frontend/e2e/pages/admin.page.ts`, `frontend/e2e/tests/admin.spec.ts`, `frontend/src/App.tsx`

**Findings:**

- **Fixed locator** — Added explicit row action hooks in UI: `data-testid="admin-open-translations-${id}"` and modal hooks (`admin-translation-modal`, `admin-translation-cs-name`, `admin-translation-cs-description`, `admin-translation-save`) to avoid brittle table-cell index selectors.
- **Stable** — Page object now prefers these test ids over structural CSS chains; resilient to column reorder and text localization.
- **Low risk** — Modal close in page object currently uses role/name `"Cancel"`; stable for EN E2E default, but if future locale-dependent E2E is added, consider adding dedicated close test id to remove language coupling.

## 2026-04-23 — Checkout test hardening (`checkout-errors.spec.ts`, `checkout.spec.ts`)

**Files touched:** `frontend/e2e/tests/checkout-errors.spec.ts`, `frontend/e2e/tests/checkout.spec.ts`

**Findings:**

- **Fixed locator usage** — Removed brittle retry loop with short click timeout around `Increase quantity`; now uses stable row-scoped locator + deterministic quantity assertion (`.cart-qty-label`) per click.
- **Stable** — Retained role-based locator `getByRole("button", { name: "Increase quantity" })` scoped to cart line, which is resilient and readable.
- **Fixed wait robustness** — Increased bank-transfer result visibility timeout for `Dummy transfer details` to account for legitimate backend response variance during checkout processing.

## 2026-04-23 — Checkout stock-ceiling concurrency hardening (`checkout-errors.spec.ts`)

**Files touched:** `frontend/e2e/tests/checkout-errors.spec.ts`

**Findings:**

- **Fixed assertion stability** — Removed hardcoded assumption that stock ceiling is always 10; test now derives the active stock ceiling from UI (`.cart-qty-stock`) and asserts final quantity equals displayed stock when `Increase quantity` becomes disabled.
- **Stable** — Kept locator scope anchored to `cart-line-${id}` + role-based button lookup to avoid brittle global selectors.

## 2026-04-24 — Product categories E2E updates (`admin.spec.ts`, `shop.spec.ts`, `App.tsx`)

**Files touched:** `frontend/e2e/tests/admin.spec.ts`, `frontend/e2e/tests/shop.spec.ts`, `frontend/src/App.tsx`

**Findings:**

- **Fixed locator stability** — Added dedicated category test ids in UI (`admin-category-select-${id}`, `admin-category-new-${id}`, `shop-category-filter-${name}`, `shop-category-breadcrumb-pick-${name}`, breadcrumb reset hook) to avoid brittle text/layout selectors.
- **Stable** — New E2E assertions use these explicit hooks and row-scoped admin save action; resilient to table column reorder and localized visible labels.
- **Low risk** — Category filter test ids currently derive from category names; safe for seed/admin-generated simple names, but if names later include special characters/spaces, a slugified hook format should be adopted.
