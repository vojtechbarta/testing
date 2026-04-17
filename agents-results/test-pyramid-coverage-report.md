# Test Pyramid Coverage Report

Generated: 2026-04-17T13:58:10.576Z

## Unit Coverage

- line: 77.27% (target >= 95%) - Warning
- function: 70.45% (target >= 95%) - Warning
- branch: 61.53% (target >= 90%) - Warning
- statement: 76.99% (target >= 95%) - Warning

### Warning: line, function, branch coverage below target
- **Missing Tests**
  - Add branch-focused tests for checkout/cart failure conditions and service error paths.
  - Add missing unit coverage for service modules without direct tests: emailService, exchangeRateService, faultAdminService, storefrontCatalogService.
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
| `POST /checkout/gateway/:orderId/mock-pay` | No |
| `POST /checkout/gateway/init` | No |
| `POST /orders` | No |
| `PUT /admin/products/:id` | No |

### Warning: Missing integration coverage for POST /checkout/gateway/:orderId/mock-pay
- **Missing Tests**
  - positive flow
  - route param
  - validation/error flow
- **Implementation Proposal**
  - Add a focused integration test block for `POST /checkout/gateway/:orderId/mock-pay` with positive + error assertions and contract checks.
- **Suggested File Placement**
  - `backend/src/integration-tests/internalApi.integration.test.ts`

### Warning: Missing integration coverage for POST /checkout/gateway/init
- **Missing Tests**
  - positive flow
  - validation/error flow
- **Implementation Proposal**
  - Add a focused integration test block for `POST /checkout/gateway/init` with positive + error assertions and contract checks.
- **Suggested File Placement**
  - `backend/src/integration-tests/internalApi.integration.test.ts`

### Warning: Missing integration coverage for POST /orders
- **Missing Tests**
  - positive flow
  - validation/error flow
- **Implementation Proposal**
  - Add a focused integration test block for `POST /orders` with positive + error assertions and contract checks.
- **Suggested File Placement**
  - `backend/src/integration-tests/internalApi.integration.test.ts`

### Warning: Missing integration coverage for PUT /admin/products/:id
- **Missing Tests**
  - positive flow
  - route param
  - validation/error flow
  - unauthorized/forbidden
- **Implementation Proposal**
  - Add a focused integration test block for `PUT /admin/products/:id` with positive + error assertions and contract checks.
  - Include explicit 401 (no token) and 403 (insufficient role) checks.
- **Suggested File Placement**
  - `backend/src/integration-tests/internalApi.integration.test.ts`


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

1. Integration/API: cover uncovered endpoints (4).
   - Highest priority: POST /checkout/gateway/:orderId/mock-pay, POST /checkout/gateway/init, POST /orders, PUT /admin/products/:id.
2. Unit: add direct tests for untested service modules (4).
   - Missing modules: emailService, exchangeRateService, faultAdminService, storefrontCatalogService.
3. UI: add dedicated checkout failure UX spec and keep flows short.
