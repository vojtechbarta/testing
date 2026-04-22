Archived: 2026-04-21

## Goal

A glanceable, auditable requirements matrix that describes the app from a business / functional point of view (as-is only), usable later for coverage analysis and acceptance-test generation.

## Output

- Single file: `docs/REQUIREMENTS.md`
- Companion sync rule: `.cursor/rules/requirements-sync.mdc` + mirror at `ai-kit/rules/requirements-sync.md` (same pattern as `.cursor/rules/faults-catalog-sync.mdc`)

## Proposed improvements to your original outline

- **Epic 2 renamed to "Cart and Checkout"** (your "Checkout"): the cart is the pre-checkout phase and is the biggest story cluster in the app; splitting it off creates two thin Epics. Still your 5-epic shape.
- **Epic 1 kept as "Product Catalog (Product List)"**: covers browse / search / sort / price filter / language / currency display / exports.
- **Personas adjusted to 4** and tagged per story:
  - **Shopper** — guest visitor of the storefront; also the person experiencing the "playground" (no app login exists for this role in code).
  - **Test Configurator** — seeded `tester` account; uses the "Bugs" panel to toggle faults.
  - **Administrator** — seeded `admin` account; manages products.
  - **Developer** — contributor to the repo; uses pyramid tooling, seed, Swagger, ai-kit skills.
- **Stable ID scheme** for traceability (this is what makes the doc usable for coverage mapping later):
  - Epics: `EP-01` … `EP-05`
  - Stories: `US-01-01`, `US-01-02` … (story number within epic)
  - Acceptance criteria: `AC-US-01-01-1`, `AC-US-01-01-2` …
- **Explicit "Persona" tag per story** (e.g. `Persona: Shopper`), so you can later filter the matrix per persona.
- **Short glossary** up top (cart session, fault level, MoreIsLess, seeded accounts, storefront money) so each story stays small and doesn't re-explain terms.

## Document structure (single file)

1. Title, one-paragraph intro, last-synced note (date + `git rev-parse HEAD`), conventions (ID scheme, persona tags, "as-is only" scope note).
2. Personas (4 subsections, one paragraph + key capabilities each).
3. Glossary (cart session, guest order, fault level UI/API/Unit, failure rate, MoreIsLess, storefront money EUR/CZK, seeded admin/tester).
4. Epic sections (each = `## EP-0X Title` → short business description → epic-level acceptance criteria → `### US-0X-0Y` subsections → story acceptance criteria bullets).
5. Per-epic or per-story plain-text evidence line in this format: `Source: backend/src/routes/products.ts, frontend/src/App.tsx` (no markdown links, Azure DevOps-friendly).

## Epics and user stories (draft scope, derived from current code)

### EP-01 Product Catalog — Persona: Shopper
- `US-01-01` Browse active products on shop home (grid from `GET /products`, active only)
- `US-01-02` Search products by submitted query (name or description contains)
- `US-01-03` Sort products (name A–Z / Z–A, price asc/desc)
- `US-01-04` Filter products by price range (server-provided bounds)
- `US-01-05` Switch language EN/CS (localized catalog)
- `US-01-06` See price in CZK (CS) or EUR (EN) when FX rate exists
- `US-01-07` Product card shows image, localized name/description, stock count, disabled Add-to-cart at stock ceiling
- `US-01-08` Export current product list as CSV or PDF
- Source: `backend/src/routes/products.ts`, `backend/src/services/storefrontCatalogService.ts`, `backend/src/shop/storefrontMoney.ts`, `frontend/src/App.tsx`.

### EP-02 Cart and Checkout — Persona: Shopper
- `US-02-01` Start a guest cart using `X-Cart-Session` (per-tab)
- `US-02-02` Add product to cart (respects stock ceiling)
- `US-02-03` Change line quantity (0 removes) and remove line
- `US-02-04` See cart totals: subtotal, optional discount row, estimated total
- `US-02-05` Apply promo code `MOREISLESS`; clear by submitting empty code
- `US-02-06` Get volume-based percent discount (1→0%, 2→10%, 3→15%, 4+→20%)
- `US-02-07` Export cart as CSV or PDF
- `US-02-08` Proceed to checkout: required buyer fields (email, first/last name, phone); optional address
- `US-02-09` Pay by bank transfer: order created PAID, stock decremented, cart + promo cleared, dummy IBAN shown
- `US-02-10` Pay via mock gateway: init pending order, mock-pay → success (PAID, stock, cart cleared) or failure (CANCELLED)
- `US-02-11` Optional confirmation email with Ethereal preview link (when configured)
- Source: `backend/src/services/cartService.ts`, `backend/src/services/checkoutService.ts`, `backend/src/shop/discountMoreIsLess.ts`, `backend/src/shop/discountPolicies.ts`.

### EP-03 Administration — Persona: Administrator
- `US-03-01` Log in as `admin` (seeded) and receive JWT (8h)
- `US-03-02` Open Admin view and see sortable product table
- `US-03-03` Edit product row inline (name, description, price, stock, active) and Save
- `US-03-04` Add a new product with defaults
- `US-03-05` Log out
- Source: `backend/src/routes/adminProducts.ts`, `backend/src/middleware/adminAuth.ts`, `backend/prisma/seed.ts`.
- Note as-is: delete product exists in API but is not wired into the admin UI; customer-user management, order management and FX editing are not in the UI.

### EP-04 Fault Injection (Tester Playground) — Persona: Test Configurator
- `US-04-01` Log in as `tester` (seeded) and access Bugs panel
- `US-04-02` See full fault catalog (key, name, description, level, enabled, latency, failure rate)
- `US-04-03` Filter faults by level ALL / UI / API / Unit
- `US-04-04` Sort faults by key / name / description / level
- `US-04-05` Toggle fault on / off
- `US-04-06` Set failure rate (only for `cart_add_ui_double_call`, `checkout_email_wrong_language`; others show N/A)
- `US-04-07` Set latency (ms)
- `US-04-08` Batch save with "Save all"; storefront picks up UI-level changes within ~1s
- `US-04-09` Catalog entries stay in sync with `docs/FAULTS.md` and seed metadata
- Source: `backend/src/routes/adminFaults.ts`, `backend/src/routes/uiFaults.ts`, `backend/src/faults/faultRuntime.ts`.

### EP-05 Technical Foundations — Persona: Developer
- `US-05-01` Local setup: MySQL via `docker-compose.yaml`, Prisma migrate + seed, backend on :4000, frontend on :5173
- `US-05-02` Run unit tests: `npm test` in `backend/` (service unit tests, Vitest, Prisma mocked)
- `US-05-03` Run integration / API tests: Vitest + Supertest against real MySQL
- `US-05-04` Run E2E: `npm run test:e2e` in `frontend/` (Playwright, chromium full + firefox/webkit smoke)
- `US-05-05` Run smoke-only / deployed-target E2E (`test:e2e:smoke`, `test:e2e:deployed`)
- `US-05-06` Generate pyramid coverage report (`agents-results/test-pyramid-coverage-report.md`)
- `US-05-07` Use coverage-increase loop with approval gate
- `US-05-08` Review Playwright locators and append findings to `agents-results/locators-reviewer-results.md`
- `US-05-09` Keep `docs/FAULTS.md`, seed metadata and runtime keys aligned (`faults-catalog-sync`)
- `US-05-10` Keep OpenAPI in sync with API changes (`swagger-openapi-sync`, `npm run docs:openapi`)
- `US-05-11` Browse live API docs at `/docs` and JSON at `/docs-json`
- `US-05-12` Archive accepted plans under `docs/plan/YYYY-MM-DD-topic.md`
- `US-05-13` Deploy to Azure (SWA + backend + MySQL Flexible Server) via GitHub Actions, optional nightly Playwright via Azure DevOps

## Maintenance mechanism

Add `.cursor/rules/requirements-sync.mdc` (and mirror in `ai-kit/rules/requirements-sync.md`) modeled on `faults-catalog-sync.mdc`: whenever user-visible behavior changes (routes, UI flows, seed, new fault, checkout rules, auth, admin UI, exports), update `docs/REQUIREMENTS.md` in the same change — specifically the relevant Epic, story IDs and acceptance bullets — and bump the "Last synced" line at the top. Keep source evidence as plain-text `Source:` tags (no markdown hyperlinks) so the document remains portable to Azure DevOps.

## What this plan will NOT do

- No Gherkin scenarios (per your choice).
- No backlog / "out of scope" sections (per your choice). Notes like "delete product is API-only" appear inline where they are functionally relevant, not as wishlist.
- No non-markdown file changes in this task.
