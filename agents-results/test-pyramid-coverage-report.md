# Test Pyramid Coverage Report

Generated: 2026-04-17T14:31:12.369Z

## Unit Coverage

- line: 95.48% (target >= 95%) - OK
- function: 97.56% (target >= 95%) - OK
- branch: 90.18% (target >= 90%) - OK
- statement: 95.22% (target >= 95%) - OK

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
| `POST /checkout/bank-transfer` | Yes |
| `POST /checkout/gateway/:orderId/mock-pay` | Yes |
| `POST /checkout/gateway/init` | Yes |
| `POST /orders` | Yes |
| `PUT /admin/products/:id` | Yes |

- No endpoint presence gaps detected in integration tests.

## UI Coverage

- Spec files: 2
- Total tests: 4
- Independent setup signals: 4/4
- Independence score: 100.00%

- No UI flow-structure warnings detected.

### Flow Inventory
- `frontend/e2e/tests/admin.spec.ts`: 1 test(s)
- `frontend/e2e/tests/shop.spec.ts`: 3 test(s)

## Prioritized Gaps

1. Integration/API: cover uncovered endpoints (0).
2. Unit: add direct tests for untested service modules (0).
3. UI: add dedicated checkout failure UX spec and keep flows short.
