# Test Pyramid Coverage Report

Generated: 2026-04-24T06:03:08.843Z

## Unit Coverage

- line: 91.97% (target >= 95%) - Warning
- function: 91.85% (target >= 95%) - Warning
- branch: 86.90% (target >= 90%) - Warning
- statement: 91.97% (target >= 95%) - Warning

### Warning: line, function, branch coverage below target
- **Missing Tests**
  - Add branch-focused tests for checkout/cart failure conditions and service error paths.
  - Add missing unit coverage for service modules without direct tests: none.
- **Implementation Proposal**
  - Add `it.each(...)` variants for invalid inputs and not-found branches.
  - Mock Prisma side effects and assert both thrown error and unchanged persisted state.
- **Suggested File Placement**
  - `backend/src/services/unit-tests/*.test.ts`

## Integration/API Coverage

| Endpoint | Covered |
|---|---|
| `DELETE /admin/products/:id` | Yes |
| `GET /admin/faults` | Yes |
| `GET /admin/products` | Yes |
| `GET /admin/products/:id/translations` | Yes |
| `GET /admin/products/categories` | Yes |
| `GET /cart` | Yes |
| `GET /docs-json` | Yes |
| `GET /exchange-rates` | Yes |
| `GET /exchange-rates/sync-status` | Yes |
| `GET /faults/inject-error` | Yes |
| `GET /faults/ui` | Yes |
| `GET /health` | Yes |
| `GET /products` | Yes |
| `PATCH /admin/faults/:key` | Yes |
| `POST /admin/products` | Yes |
| `POST /auth/login` | Yes |
| `POST /cart/items` | Yes |
| `POST /cart/promotion` | Yes |
| `POST /checkout/bank-transfer` | Yes |
| `POST /checkout/gateway/:orderId/mock-pay` | Yes |
| `POST /checkout/gateway/init` | Yes |
| `POST /exchange-rates/sync-now` | Yes |
| `POST /orders` | Yes |
| `PUT /admin/products/:id` | Yes |
| `PUT /admin/products/:id/translations/:locale` | Yes |

- No endpoint presence gaps detected in integration tests.

## UI Coverage

- Spec files: 8
- Total tests: 24
- Independent setup signals: 24/24
- Independence score: 100.00%
- Perspective coverage: shop=Yes, admin=Yes, tester=Yes
- Matrix coverage: 10/10 area(s) fully covered

### Warning: 1 long chained test flow(s) detected
- **Missing Tests**
  - Add short isolated checkout error UX flow (validation + retry).
  - Add explicit post-failure state continuity checks.
- **Implementation Proposal**
  - Split long scenarios into multiple tests with fresh `goto()` setup.
  - Reuse page-object methods to keep selectors stable and tests readable.
- **Suggested File Placement**
  - `frontend/e2e/tests/shop.spec.ts`
  - `frontend/e2e/tests/checkout-errors.spec.ts`

### UI Area Coverage Matrix
| Area | Status | Missing Scenarios |
|---|---|---|
| `auth.login` (Authentication login flows) | Covered | - |
| `shop.catalog` (Shop catalog browsing) | Covered | - |
| `shop.cart` (Shop cart interactions) | Covered | - |
| `shop.checkout` (Checkout happy-path flows) | Covered | - |
| `shop.checkoutErrors` (Checkout validation and failure recovery) | Covered | - |
| `admin.products` (Admin product management) | Covered | - |
| `tester.faults` (Tester fault-management UI) | Covered | - |
| `exports.products` (Products export flows) | Covered | - |
| `exports.cart` (Cart export flows) | Covered | - |
| `i18n.languageSwitch` (Language switch behavior) | Covered | - |

### Cross-browser Smoke Eligibility
- Smoke-eligible areas: 7/10
- Smoke-ineligible areas: 3

| Area | Smoke Eligible |
|---|---|
| `auth.login` (Authentication login flows) | Yes |
| `shop.catalog` (Shop catalog browsing) | Yes |
| `shop.cart` (Shop cart interactions) | Yes |
| `shop.checkout` (Checkout happy-path flows) | Yes |
| `shop.checkoutErrors` (Checkout validation and failure recovery) | No |
| `admin.products` (Admin product management) | Yes |
| `tester.faults` (Tester fault-management UI) | Yes |
| `exports.products` (Products export flows) | No |
| `exports.cart` (Cart export flows) | No |
| `i18n.languageSwitch` (Language switch behavior) | Yes |

### Flow Inventory
- `frontend/e2e/tests/admin.spec.ts`: 3 test(s)
- `frontend/e2e/tests/auth.spec.ts`: 3 test(s)
- `frontend/e2e/tests/checkout-errors.spec.ts`: 2 test(s)
- `frontend/e2e/tests/checkout.spec.ts`: 1 test(s)
- `frontend/e2e/tests/i18n.spec.ts`: 1 test(s)
- `frontend/e2e/tests/locator-audit-demo-bad-patterns.spec.ts`: 1 test(s)
- `frontend/e2e/tests/shop.spec.ts`: 8 test(s)
- `frontend/e2e/tests/tester.spec.ts`: 5 test(s)

## Prioritized Gaps

1. Integration/API: cover uncovered endpoints (0).
2. Unit: add direct tests for untested service modules (0).
3. UI: keep flows short and cover shop/admin/tester perspectives.
   - Split 1 long chained flow(s).
