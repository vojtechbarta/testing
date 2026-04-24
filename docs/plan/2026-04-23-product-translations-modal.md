Archived: 2026-04-23

# Admin product translations without widening the table

## Overview

Today Czech storefront text is not editable in Admin: it comes from static maps keyed by seeded product IDs, while Admin edits English `name`/`description` in the DB. The best way to keep the admin table compact and support Czech (and future locales) is a separate translations store plus a row action that opens a focused dialog, not extra table columns.

## Plan

### 1) Data model: normalized translations table

- Add `ProductTranslation` (or equivalent) instead of adding `nameCs`/`descriptionCs` to `Product`.
- Fields: `productId`, `locale`, `name`, `description`.
- Unique key: `(productId, locale)`.

### 2) Storefront text resolution

- Update [`backend/src/shop/storefrontProductText.ts`](../../backend/src/shop/storefrontProductText.ts) to resolve `cs` copy from DB translation first.
- Keep hardcoded Czech maps as temporary fallback during migration from static copy.
- Load translations in storefront query efficiently to avoid N+1 lookups.

### 3) Search behavior

- Decide whether Czech storefront search should match translation text in addition to canonical product text.

### 4) Admin UX (translations modal)

- Keep existing admin table compact and unchanged for core product ops.
- Add one per-row action (`Translations`/`CS`) in [`frontend/src/App.tsx`](../../frontend/src/App.tsx).
- Open focused modal for one product with Czech `name` and `description` fields plus save/cancel.
- Optional missing-translation indicator (`CS missing`) for quick scanning.

### 5) API and migration

- Add admin translation endpoints (GET product translations, PUT Czech translation upsert) in [`backend/src/routes/adminProducts.ts`](../../backend/src/routes/adminProducts.ts) and service layer.
- Migrate seeded Czech copy from [`backend/src/shop/czechProductCopy.ts`](../../backend/src/shop/czechProductCopy.ts) to DB rows.

### 6) Testing strategy

- Unit/service tests for translation resolution and fallback behavior.
- Integration test for translation upsert endpoint.
- Simple Playwright E2E for the new modal:
  - extend [`frontend/e2e/pages/shop.page.ts`](../../frontend/e2e/pages/shop.page.ts) with modal helpers;
  - open modal from admin product row;
  - set Czech name/description;
  - save and reopen modal;
  - verify persisted values.

### 7) Required docs/sync

- Update OpenAPI annotations and schemas for new admin translation endpoints.
- Run Prisma migration verification on fresh DB.
- Sync user-visible behavior in [`docs/REQUIREMENTS.md`](../REQUIREMENTS.md).

## Todos

- `schema-migration`: Add `ProductTranslation` model + migration; optional seed from `czechProductCopy.ts`.
- `storefront-resolve`: Load translations in storefront path; update `storefrontProductText`; decide/implement Czech search.
- `admin-api`: Add GET/PUT translation routes; OpenAPI + service helpers.
- `admin-ui-modal`: Add per-row translations button/modal and UI copy.
- `tests-docs`: Add backend tests + simple Playwright modal E2E + requirements sync.

## As built

- Delivered: `ProductTranslation` model and migration, admin translation routes, per-row **Edit CS** modal in `frontend/src/App.tsx`, and storefront name/description resolution via `storefrontProductText` (with tests and OpenAPI where applicable). See `git log` on `main` for the `feat(admin): … product translations` commits.
- User-visible scope is reflected in `docs/REQUIREMENTS.md` for the same feature window.
- No material deviations from the archived plan; Czech search beyond canonical text was left as a follow-up if product asks for it.
