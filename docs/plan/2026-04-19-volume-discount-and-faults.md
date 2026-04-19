Archived: 2026-04-19

# Volume discount (MoreIsLess) + partition fault injection

**Status:** Implemented in repo (Prisma, API, checkout, email, frontend, tests).

## Decisions

- **Volume** = **sum of line quantities** (not distinct SKUs only).
- **No code in session** → no discount; **code `MOREISLESS`** (case-insensitive) → tiered %.
- **Tiers (baseline):** 1 unit → 0%; 2 → 10%; 3 → 15%; 4+ → 20%.
- **Partition faults (API, off by default):** `discount_more_is_less_boundary_4`, `discount_more_is_less_empty_at_10`, `discount_more_is_less_tier_20_plus_50pct` — see `FAULT_KEYS` in `backend/src/faults/faultRuntime.ts` and seed in `backend/prisma/seed.ts`.

## Data model

- `CartPromotion` — `cartKey` (PK), `appliedCode`.
- `Order` — `subtotalBeforeDiscount`, `discountAmount`, `discountCode`, `discountPercent` (plus existing `total`).

## Key files

| Area | Path |
|------|------|
| Policy (pure) | `backend/src/shop/discountPolicies.ts` |
| Runtime + code | `backend/src/shop/discountMoreIsLess.ts` |
| Storage pricing | `backend/src/services/checkoutOrderPricing.ts` |
| Cart | `backend/src/services/cartService.ts`, `backend/src/routes/cart.ts` (`POST /cart/promotion`) |
| Checkout | `backend/src/services/checkoutService.ts` |
| Email | `backend/src/services/emailService.ts` |
| Migration | `backend/prisma/migrations/20260419100000_cart_promotion_order_discount/migration.sql` |
| Frontend | `frontend/src/App.tsx`, `frontend/src/api/cart.ts`, `frontend/src/api/checkout.ts` |
| Tests | `backend/src/services/unit-tests/discountPolicies.test.ts`, `cartService.test.ts`, `checkoutService.test.ts`, `internalApi.integration.test.ts`, `frontend/src/exportHelpers.test.ts`, `frontend/e2e/tests/shop.spec.ts` |

## OpenAPI

- Regenerate with `cd backend && npm run docs:openapi` when routes change; `Cart` includes `subtotal`, `discount`, `total`.

## Plan source

Full narrative spec (todos / mermaid) may also exist under Cursor plans as `volume_discount_and_faults_324a1a9e.plan.md`.
