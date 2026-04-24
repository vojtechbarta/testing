Archived: 2026-04-24

# Product Categories TDD Plan

## Scope Locked
- Add normalized categories with fallback `other`.
- Admin product flow: select existing category or create new inline.
- Storefront: keep top breadcrumb as single-path category navigation, plus separate multi-select category filter.
- Include category in product exports.
- Seed categories for seeded products.
- Execute test-first slices, then E2E, then full test run and pyramid coverage delta.

## Architecture Changes
- **Database/model**
  - Add `Category` model and relation on `Product` in [backend/prisma/schema.prisma](backend/prisma/schema.prisma).
  - Ensure fallback category key/name `other` exists and is assigned for products without explicit category.
- **Backend API/service**
  - Extend admin product create/update payload handling in [backend/src/routes/adminProducts.ts](backend/src/routes/adminProducts.ts).
  - Extend product DTO/service mapping + creation logic in [backend/src/services/productService.ts](backend/src/services/productService.ts).
  - Extend storefront query parsing/filter behavior in [backend/src/routes/products.ts](backend/src/routes/products.ts) and [backend/src/services/storefrontCatalogService.ts](backend/src/services/storefrontCatalogService.ts).
  - Add category listing/create support as needed for admin UX (likely in admin products route/service path unless existing router is better).
  - Update API docs/contracts in [backend/src/docs/openapi.ts](backend/src/docs/openapi.ts).
- **Frontend UI/API**
  - Extend admin API client payload/types in [frontend/src/api/admin.ts](frontend/src/api/admin.ts).
  - Extend storefront API query/types in [frontend/src/api/products.ts](frontend/src/api/products.ts).
  - Implement admin inline category selector + “new category” input in [frontend/src/App.tsx](frontend/src/App.tsx).
  - Implement breadcrumb single-path category nav + separate multi-select filter control in [frontend/src/App.tsx](frontend/src/App.tsx).
  - Extend export rows and headers in [frontend/src/exportHelpers.ts](frontend/src/exportHelpers.ts) and corresponding usage in [frontend/src/App.tsx](frontend/src/App.tsx).
- **Seeding & docs**
  - Add seeded categories + product-category assignments in [backend/prisma/seed.ts](backend/prisma/seed.ts).
  - If any fault behavior/keys change (not currently planned), sync [docs/FAULTS.md](docs/FAULTS.md).

## TDD Execution (Vertical Slices)
1. **Slice 1: Model + fallback behavior**
   - RED: backend tests for category fallback to `other` on product create/update when missing.
   - GREEN: schema/service changes minimal to pass.
2. **Slice 2: Admin existing category selection**
   - RED: backend integration tests for create/update with categoryId and category retrieval.
   - GREEN: route/service wiring.
3. **Slice 3: Admin inline new category creation**
   - RED: integration tests for creating product with new category name and dedupe/validation behavior.
   - GREEN: minimal logic to create-or-reuse category.
4. **Slice 4: Storefront filtering contract**
   - RED: backend storefront tests for breadcrumb single category filter + separate multi-select category filter semantics.
   - GREEN: query parsing and filtering implementation.
5. **Slice 5: Export includes category column**
   - RED: frontend unit tests in export helper tests for category output.
   - GREEN: export row/header updates.
6. **Slice 6: UI behavior + E2E**
   - RED: Playwright tests for admin create/select category and storefront breadcrumb + multi-select filtering flow.
   - GREEN: frontend UI implementation.
7. **Refactor**
   - Consolidate category normalization utilities and remove duplication with tests green.

## Verification & Reporting
- Run backend + frontend unit/integration test suites.
- Run Playwright E2E suite (or at least category-focused specs + smoke, then full if feasible).
- Run evaluator script:
  - `node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs`
- Report pyramid delta by comparing previous and new [agents-results/test-pyramid-coverage-report.md](agents-results/test-pyramid-coverage-report.md).

## Risks / Guardrails
- Keep baseline tests strict (do not weaken for injected faults).
- Avoid breaking existing product query params; add category params backward-compatibly.
- Ensure category fallback is deterministic and migration-safe.
- Keep TDD tracer-bullet rhythm: one behavior test -> minimal code -> green.

## As built
- Implemented a normalized category domain with `Product.categoryId`, fallback to `other`, seeded categories, and migration verification on a fresh database.
- Shipped admin category workflows (select existing + inline create), storefront breadcrumb + multi-select category filtering, and category export column in CSV/PDF.
- Added/updated backend unit + integration coverage and Playwright E2E flows for categories; full backend/frontend tests and full E2E suite passed.
- Regenerated OpenAPI, updated requirements docs, and produced updated test pyramid report (`agents-results/test-pyramid-coverage-report.md`).
- Commit/PR reference: not created in this task.
