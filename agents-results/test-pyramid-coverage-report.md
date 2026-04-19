# Test Pyramid Coverage Report

Generated: 2026-04-19T07:04:30.173Z

## Unit Coverage

- line: 97.22% (target >= 95%) - OK
- function: 98.90% (target >= 95%) - OK
- branch: 92.23% (target >= 90%) - OK
- statement: 97.15% (target >= 95%) - OK

- No threshold warnings at Unit level.

## Integration/API Coverage

| Endpoint | Covered |
|---|---|
| `DELETE /admin/products/:id` | Yes |
| `GET /admin/faults` | Yes |
| `GET /admin/products` | Yes |
| `GET /cart` | Yes |
| `GET /docs-json` | Yes |
| `GET /exchange-rates` | Yes |
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
| `POST /orders` | Yes |
| `PUT /admin/products/:id` | Yes |

- No endpoint presence gaps detected in integration tests.

## UI Coverage

- Spec files: 8
- Total tests: 19
- Independent setup signals: 19/19
- Independence score: 100.00%
- Perspective coverage: shop=Yes, admin=Yes, tester=Yes
- Matrix coverage: 10/10 area(s) fully covered

- No UI flow-structure warnings detected.

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
- `frontend/e2e/tests/admin.spec.ts`: 1 test(s)
- `frontend/e2e/tests/auth.spec.ts`: 3 test(s)
- `frontend/e2e/tests/checkout-errors.spec.ts`: 2 test(s)
- `frontend/e2e/tests/checkout.spec.ts`: 1 test(s)
- `frontend/e2e/tests/i18n.spec.ts`: 1 test(s)
- `frontend/e2e/tests/locator-audit-demo-bad-patterns.spec.ts`: 1 test(s)
- `frontend/e2e/tests/shop.spec.ts`: 5 test(s)
- `frontend/e2e/tests/tester.spec.ts`: 5 test(s)

## Prioritized Gaps

1. Integration/API: cover uncovered endpoints (0).
2. Unit: add direct tests for untested service modules (0).
3. UI: keep flows short and cover shop/admin/tester perspectives.
