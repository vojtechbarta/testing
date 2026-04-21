# Functional Requirements Matrix

Last synced: 2026-04-21 (commit `298d35c`)
Scope: As-is functionality only (implemented behavior in current codebase)

## Purpose

This document describes the system from a business and functional perspective. It is organized as Epics and User Stories with explicit acceptance criteria so it can be reused for coverage analysis, acceptance test case generation, and future traceability.

## Conventions

- Epic IDs: `EP-01` to `EP-05`
- User Story IDs: `US-XX-YY` where `XX` is epic number and `YY` is story sequence
- Acceptance Criteria IDs: `AC-US-XX-YY-N`
- Persona is stated per story
- `Source:` lines are plain text pointers to implementation evidence (no repository hyperlinks)

## Personas

### Shopper

Guest user of the storefront. Browses products, manages cart, applies promotions, and completes checkout. This persona also experiences the product as a testing playground.

### Test Configurator

User with `tester` credentials. Uses the Bugs panel to activate and configure injected faults for testing scenarios.

### Administrator

User with `admin` credentials. Manages the product catalog from the Admin interface.

### Developer

Project contributor who runs environments, tests, coverage workflows, and technical maintenance conventions.

## Glossary

- Cart session: Guest cart identity carried via `X-Cart-Session` header.
- Guest order: Order placed without customer account login, tied to cart session flow.
- Fault levels:
  - UI: Frontend behavior fault.
  - API: Route/controller behavior fault.
  - Unit: Service/data layer behavior fault.
- Failure rate: Probability-like value used by supported faults.
- MoreIsLess: Promotion code `MOREISLESS` with quantity tiers.
- Storefront money: Product prices shown in CZK or EUR depending on language/FX behavior.
- Seeded accounts: Pre-seeded users for admin and tester roles.

## EP-01 Product Catalog

Business goal: Shopper can discover products, compare options quickly, and export listings.

Epic acceptance criteria:
- Catalog is accessible in shop mode and contains active products.
- Shopper can discover products through search, sort, and price filtering.
- Product listing supports language-aware display and exports.

### US-01-01 Browse active products on shop home
Persona: Shopper

Business details:
- Shop is the default user-facing mode and renders product cards in a single catalog surface.
- Product cards are expected to support quick decision-making without requiring a dedicated product detail page.

Acceptance criteria:
- `AC-US-01-01-1`: System shows a product grid in shop mode where each product tile contains image (or placeholder when image is unavailable), localized product name, localized short description, localized unit price with currency, current in-stock quantity, and primary Add-to-cart action.
- `AC-US-01-01-2`: Returned catalog excludes inactive products.
- `AC-US-01-01-3`: Product card contains at minimum name, description, current price, and stock information shown as available units (for example "In stock: 12"), and this stock state controls whether Add-to-cart is enabled.

### US-01-02 Search products by submitted query
Persona: Shopper

Business details:
- Search is intentional (submit-driven), so user can type safely before triggering catalog refresh.
- Search scope is business-friendly free text over product naming and descriptive content.

Acceptance criteria:
- `AC-US-01-02-1`: Shopper can submit a text query.
- `AC-US-01-02-2`: System filters products by matching name or description.
- `AC-US-01-02-3`: Catalog refresh is triggered by submitted query state, not every keypress.
- `AC-US-01-02-4`: Shopper can clear search and submit an empty query to return the catalog for the current language, selected sort, and selected price range, without text-based filtering.

### US-01-03 Sort products
Persona: Shopper

Business details:
- Sorting must support both discovery intent (name order) and price comparison intent.
- Sort selection is part of active query state and affects both on-screen ordering and export baseline.

Acceptance criteria:
- `AC-US-01-03-1`: Shopper can choose sort by name ascending/descending.
- `AC-US-01-03-2`: Shopper can choose sort by price ascending/descending.
- `AC-US-01-03-3`: Selected sort is applied to current catalog query response.

### US-01-04 Filter products by price range
Persona: Shopper

Business details:
- Price filtering uses minimum and maximum limits provided by the server for the current catalog view.
- Filter controls support both slider-like and numeric precision input patterns.

Acceptance criteria:
- `AC-US-01-04-1`: Shopper can set minimum and maximum price.
- `AC-US-01-04-2`: System returns products within selected bounds.
- `AC-US-01-04-3`: Initial filter limits come from the price range returned by the catalog API.

### US-01-05 Switch language EN/CS
Persona: Shopper

Business details:
- Language switch is a core business requirement because storefront is bilingual.
- When user changes language, the catalog updates in a way that keeps search and filters understandable and consistent in the newly selected language.

Acceptance criteria:
- `AC-US-01-05-1`: Shopper can switch storefront language to English or Czech.
- `AC-US-01-05-2`: Catalog labels/content are displayed in selected language where localized.
- `AC-US-01-05-3`: Page language setting follows the selected storefront language.

### US-01-06 View storefront price in CZK or EUR
Persona: Shopper

Business details:
- Price display follows the selected storefront language to support domestic and international views.
- Currency conversion affects display only; stored product prices remain consistent in backend data.

Acceptance criteria:
- `AC-US-01-06-1`: Czech storefront shows CZK pricing.
- `AC-US-01-06-2`: English storefront can display EUR pricing when FX rate is available.
- `AC-US-01-06-3`: Price formatting follows local conventions (currency symbol and number format).

### US-01-07 View product card details and stock-aware add action
Persona: Shopper

Business details:
- Catalog cards expose stock transparency to reduce checkout frustration.
- Add-to-cart must clearly show availability limits before the system would reject an over-limit add.

Acceptance criteria:
- `AC-US-01-07-1`: Product card shows image, localized title/description, and stock count.
- `AC-US-01-07-2`: Add-to-cart action is disabled when requested amount reaches stock limit.
- `AC-US-01-07-3`: Card-level behavior remains consistent after cart refresh.

### US-01-08 Export product list
Persona: Shopper

Business details:
- Export supports offline review and sharing of currently visible catalog state.
- Export content matches the catalog currently shown on screen (search, sort, and filter result set).

Acceptance criteria:
- `AC-US-01-08-1`: Shopper can export current listing as CSV.
- `AC-US-01-08-2`: Shopper can export current listing as PDF.
- `AC-US-01-08-3`: Export files are generated with timestamped filenames.
- `AC-US-01-08-4`: Export content reflects the currently selected storefront language (localized text and language-specific product fields).
- `AC-US-01-08-5`: Export content matches the catalog currently shown on screen, including active search query, selected sort, and selected price-filter result set.

Source: `backend/src/routes/products.ts`, `backend/src/services/storefrontCatalogService.ts`, `backend/src/shop/storefrontMoney.ts`, `frontend/src/App.tsx`, `frontend/src/productImages.ts`

## EP-02 Cart and Checkout

Business goal: Shopper can build an order as guest, receive correct totals, and complete payment flow.

Epic acceptance criteria:
- Cart supports quantity management with stock constraints.
- Checkout supports buyer details and payment path completion.
- Promotion and totals are reflected from cart to order creation.

### US-02-01 Start guest cart session
Persona: Shopper

Business details:
- Customers can start using the cart right away, without signing in.
- Session continuity is maintained per browser tab to preserve user test scenarios.

Acceptance criteria:
- `AC-US-02-01-1`: Cart operations use `X-Cart-Session`.
- `AC-US-02-01-2`: Session identity is retained for shopper tab lifecycle.
- `AC-US-02-01-3`: Cart requests use the same session key until the tab session ends.

### US-02-02 Add product to cart
Persona: Shopper

Business details:
- Add action increments intent from catalog directly, minimizing friction to checkout.
- Stock limits are enforced in both the UI controls and backend validation.

Acceptance criteria:
- `AC-US-02-02-1`: Shopper can add an available product to cart.
- `AC-US-02-02-2`: System prevents quantity beyond available stock.
- `AC-US-02-02-3`: Cart state refreshes after successful add operation.

### US-02-03 Update or remove cart line
Persona: Shopper

Business details:
- Quantity controls support iterative adjustment without re-adding from catalog.
- Removing an item is handled by setting its quantity to zero.

Acceptance criteria:
- `AC-US-02-03-1`: Shopper can increase or decrease line quantity.
- `AC-US-02-03-2`: Quantity `0` removes the cart line.
- `AC-US-02-03-3`: Cart totals are recalculated after each line update.

### US-02-04 View cart totals
Persona: Shopper

Business details:
- Totals are visible before checkout commitment to reduce payment surprises.
- Discount line appears conditionally to keep summary clear when no promo is active.

Acceptance criteria:
- `AC-US-02-04-1`: Cart shows subtotal.
- `AC-US-02-04-2`: Cart shows discount line when promotion applies.
- `AC-US-02-04-3`: Cart shows estimated total.
- `AC-US-02-04-4`: Totals remain consistent between cart view and checkout payment step.

### US-02-05 Apply or clear promotion code
Persona: Shopper

Business details:
- Promotion input is explicit and user-controlled, with immediate effect on totals after apply.
- Empty submission acts as a clear operation to simplify promo rollback.

Acceptance criteria:
- `AC-US-02-05-1`: Entering a valid promotion code applies promotion.
- `AC-US-02-05-2`: Empty code input clears promotion.
- `AC-US-02-05-3`: Promo submission accepts trimmed user input.

### US-02-06 Receive volume-based discount policy
Persona: Shopper

Business details:
- This story describes the concrete implementation of the `MOREISLESS` promotion, where discount is based on total quantity in cart.
- Discount is quantity-driven across total cart line quantities, not per-item coupon targeting.
- Tier policy incentivizes larger basket size and is visible through totals and discount rows.

Acceptance criteria:
- `AC-US-02-06-1`: Tier logic applies 0/10/15/20% for quantities 1/2/3/4+.
- `AC-US-02-06-2`: Discount is reflected in cart and checkout totals.
- `AC-US-02-06-3`: Checkout order pricing persists discount fields used at cart stage.

### US-02-07 Export cart
Persona: Shopper

Business details:
- Cart export enables external review, testing evidence, and support for business handoff scenarios.
- Export output includes quantities and monetary summary information.

Acceptance criteria:
- `AC-US-02-07-1`: Shopper can export cart as CSV.
- `AC-US-02-07-2`: Shopper can export cart as PDF.
- `AC-US-02-07-3`: Export file naming uses timestamp-based uniqueness.
- `AC-US-02-07-4`: Export content reflects the currently selected storefront language (localized labels and language-specific product fields).

### US-02-08 Enter buyer data in checkout
Persona: Shopper

Business details:
- Checkout opens as a step-by-step dialog, with buyer details first so the order has contact information.
- Required fields balance business necessity (contact/identity) and friction control.

Acceptance criteria:
- `AC-US-02-08-1`: Required fields are email, first name, last name, and phone.
- `AC-US-02-08-2`: Address fields are optional.
- `AC-US-02-08-3`: Validation errors block progression until required buyer fields are valid.

### US-02-09 Complete bank transfer checkout
Persona: Shopper

Business details:
- Bank transfer path is immediate confirmation flow with dummy payment instructions for testing.
- Completion finalizes stock changes and cart cleanup together as part of one checkout completion flow.

Acceptance criteria:
- `AC-US-02-09-1`: Order is created as paid via bank transfer path.
- `AC-US-02-09-2`: Stock is decremented for ordered quantities.
- `AC-US-02-09-3`: Cart and promotion are cleared after completion.
- `AC-US-02-09-4`: Shopper sees dummy transfer instructions (including IBAN).
- `AC-US-02-09-5`: Bank result step can present email status information when available.

### US-02-10 Complete mock gateway payment
Persona: Shopper

Business details:
- Gateway path models asynchronous payment behavior via explicit init and pay actions.
- Result handling must distinguish approved and declined outcomes for test realism.

Acceptance criteria:
- `AC-US-02-10-1`: Gateway init creates or reuses pending order for session.
- `AC-US-02-10-2`: Successful mock pay marks order paid, decrements stock, and clears cart.
- `AC-US-02-10-3`: Failed mock pay cancels order.
- `AC-US-02-10-4`: Gateway payment step shows order details (order ID and amount due).

### US-02-11 Receive optional checkout email
Persona: Shopper

Business details:
- Email sending is environment-dependent and optional to keep local/dev setup flexible.
- When enabled, checkout surfaces enough feedback to validate communication outcomes.

Acceptance criteria:
- `AC-US-02-11-1`: System can send confirmation email when configured.
- `AC-US-02-11-2`: Email preview link is available in Ethereal-based flow.
- `AC-US-02-11-3`: Email language follows checkout language unless an injected fault changes it.

Source: `backend/src/services/cartService.ts`, `backend/src/services/checkoutService.ts`, `backend/src/services/checkoutOrderPricing.ts`, `backend/src/shop/discountMoreIsLess.ts`, `backend/src/shop/discountPolicies.ts`, `frontend/src/App.tsx`

## EP-03 Administration

Business goal: Administrator can manage product catalog data securely.

Epic acceptance criteria:
- Admin login grants access to admin-only product management.
- Admin can create and update products in the UI.
- Session can be terminated through logout.

### US-03-01 Log in as administrator
Persona: Administrator

Business details:
- Admin and tester share login entry point but diverge by role-based post-login navigation.
- Session token and role are stored on the client to support practical admin sessions.

Acceptance criteria:
- `AC-US-03-01-1`: Admin can authenticate with seeded admin credentials.
- `AC-US-03-01-2`: Successful login returns a token-authenticated admin session.
- `AC-US-03-01-3`: Admin role is stored and reused to restore session until logout or token expiry.

### US-03-02 View product management table
Persona: Administrator

Business details:
- Product table is the operational control center for catalog maintenance.
- Table surfaces essential commercial fields needed for availability and pricing governance.

Acceptance criteria:
- `AC-US-03-02-1`: Admin can open product table with core product fields.
- `AC-US-03-02-2`: Table supports sorting-oriented management behavior.
- `AC-US-03-02-3`: Admin view is accessible only for authenticated admin role.

### US-03-03 Update existing product inline
Persona: Administrator

Business details:
- Inline edit shortens admin throughput by avoiding separate edit forms.
- Save action acts per edited row to keep operational changes granular and controlled.

Acceptance criteria:
- `AC-US-03-03-1`: Admin can edit name, description, price, stock, and active state.
- `AC-US-03-03-2`: Save persists updated values.
- `AC-US-03-03-3`: Updated product changes become visible in subsequent admin refresh.

### US-03-04 Create new product
Persona: Administrator

Business details:
- New product creation starts from sensible defaults for fast catalog extension.
- Created records must become manageable immediately through the same inline table flow.

Acceptance criteria:
- `AC-US-03-04-1`: Admin can create new product row with defaults.
- `AC-US-03-04-2`: Created product is available in admin dataset after save.
- `AC-US-03-04-3`: Created product can be further adjusted through inline edit/save.

### US-03-05 Log out of admin session
Persona: Administrator

Business details:
- Logout is explicit and clears stored role/token data to avoid stale privileged sessions.
- Session-expired handling should safely move user back to login-capable state.

Acceptance criteria:
- `AC-US-03-05-1`: Admin can end session via logout action.
- `AC-US-03-05-2`: UI leaves admin-only view after logout.
- `AC-US-03-05-3`: Invalid/expired token flow clears stored credentials and prompts re-login.

Source: `backend/src/routes/auth.ts`, `backend/src/routes/adminProducts.ts`, `backend/src/middleware/adminAuth.ts`, `backend/prisma/seed.ts`, `frontend/src/App.tsx`, `frontend/src/api/admin.ts`

## EP-04 Fault Injection (Tester Playground)

Business goal: Test configurator can manipulate controlled faults for testing and observation.

Epic acceptance criteria:
- Tester can access and edit fault configurations.
- Fault catalog can be filtered/sorted for operational use.
- Fault settings are saved and then affect app behavior.

### US-04-01 Log in as tester
Persona: Test Configurator

Business details:
- Tester role is dedicated to fault operations and does not provide admin catalog management.
- Role-based navigation sends tester directly to the Bugs workflow after login.

Acceptance criteria:
- `AC-US-04-01-1`: Tester can authenticate with seeded tester credentials.
- `AC-US-04-01-2`: Authenticated tester can access Bugs panel.
- `AC-US-04-01-3`: Tester role cannot access admin-only product management actions.

### US-04-02 View fault catalog entries
Persona: Test Configurator

Business details:
- Fault table is the main working area for configuring test scenarios.
- Each entry must provide enough details to decide whether and how to enable a fault.

Acceptance criteria:
- `AC-US-04-02-1`: Fault list shows key, name, description, level, enabled state, latency, and failure-rate details.
- `AC-US-04-02-2`: Fault details are presented in a manageable table form.
- `AC-US-04-02-3`: Unsupported failure-rate faults clearly show non-applicable state.

### US-04-03 Filter faults by level
Persona: Test Configurator

Business details:
- Level filters support focused fault experiments (UI vs API vs Unit) and reduce operational noise.

Acceptance criteria:
- `AC-US-04-03-1`: Tester can filter by ALL, UI, API, or Unit.
- `AC-US-04-03-2`: Visible rows reflect selected level filter.

### US-04-04 Sort faults
Persona: Test Configurator

Business details:
- Sorting supports fast lookup during debugging and test execution sessions.

Acceptance criteria:
- `AC-US-04-04-1`: Tester can sort by key, name, description, and level.
- `AC-US-04-04-2`: Sorting updates list order consistently for the same selected sort.

### US-04-05 Toggle fault enabled state
Persona: Test Configurator

Business details:
- Enable/disable actions are intentionally staged to avoid accidental immediate activation.
- Staging model supports batch-oriented experiment setup before commit.

Acceptance criteria:
- `AC-US-04-05-1`: Tester can enable or disable each fault entry.
- `AC-US-04-05-2`: Changes are staged until save action.
- `AC-US-04-05-3`: UI communicates that edits are local before Save all.

### US-04-06 Configure failure rate on supported faults
Persona: Test Configurator

Business details:
- Failure-rate control enables percentage-based fault behavior across repeated test runs.
- Applicability is limited to explicitly supported fault keys.

Acceptance criteria:
- `AC-US-04-06-1`: `cart_add_ui_double_call` and `checkout_email_wrong_language` support failure rate editing.
- `AC-US-04-06-2`: Unsupported faults show non-editable failure-rate indication.
- `AC-US-04-06-3`: Failure-rate input supports decimal values in 0..1 range.

### US-04-07 Configure latency
Persona: Test Configurator

Business details:
- Latency tuning allows simulation of degraded behavior without full failure.

Acceptance criteria:
- `AC-US-04-07-1`: Tester can edit latency value in milliseconds.
- `AC-US-04-07-2`: Edited value is included in saved fault update request.

### US-04-08 Save staged fault changes
Persona: Test Configurator

Business details:
- Save all provides controlled commit point for multiple changes.
- After save, shop should reflect UI-fault impact without requiring manual app reload.

Acceptance criteria:
- `AC-US-04-08-1`: Save all persists staged changes for all edited faults.
- `AC-US-04-08-2`: UI-level fault set can be refreshed for storefront behavior update.
- `AC-US-04-08-3`: Save action reports failure if any fault update call fails.

### US-04-09 Keep fault catalog aligned with documented references
Persona: Test Configurator

Business details:
- Fault catalog consistency is critical for trustworthy test scenarios across UI, API, and docs.

Acceptance criteria:
- `AC-US-04-09-1`: Active fault keys match saved fault entries.
- `AC-US-04-09-2`: Fault details remain aligned with `docs/FAULTS.md` and seed definitions.

Source: `backend/src/routes/adminFaults.ts`, `backend/src/routes/uiFaults.ts`, `backend/src/faults/faultRuntime.ts`, `backend/prisma/seed.ts`, `docs/FAULTS.md`, `frontend/src/App.tsx`

## EP-05 Technical Foundations

Business goal: Developer can run, validate, and maintain the system and testing strategy.

Epic acceptance criteria:
- Local environment can be started and seeded.
- Test pyramid layers are runnable and distinguishable.
- Documentation and maintenance practices support long-term reliability.

### US-05-01 Run local environment
Persona: Developer

Acceptance criteria:
- `AC-US-05-01-1`: Developer can start MySQL using local Docker Compose setup.
- `AC-US-05-01-2`: Developer can run Prisma migrations and seed data.
- `AC-US-05-01-3`: Developer can run backend and frontend on expected ports.

### US-05-02 Execute backend unit tests
Persona: Developer

Acceptance criteria:
- `AC-US-05-02-1`: Backend unit tests run with Vitest.
- `AC-US-05-02-2`: Unit scope covers service-level behaviors with mocked Prisma where designed.

### US-05-03 Execute integration/API tests
Persona: Developer

Acceptance criteria:
- `AC-US-05-03-1`: Integration tests run against app routes via Supertest.
- `AC-US-05-03-2`: Integration flow uses real MySQL-backed behavior.

### US-05-04 Execute E2E suite
Persona: Developer

Acceptance criteria:
- `AC-US-05-04-1`: Playwright E2E can run against local app.
- `AC-US-05-04-2`: Browser project strategy includes full chromium and smoke firefox/webkit.

### US-05-05 Run smoke/deployed E2E variants
Persona: Developer

Acceptance criteria:
- `AC-US-05-05-1`: Smoke subset can run independently.
- `AC-US-05-05-2`: Deployed-target E2E can run with provided base URLs.

### US-05-06 Generate pyramid coverage report
Persona: Developer

Business details:
- Purpose is to understand whether testing is balanced across Unit, Integration/API, and UI layers, instead of over-relying on one layer.
- Coverage analysis helps identify missing scenarios early and turn them into concrete follow-up test proposals.
- Report is used as an input for planning next testing improvements and tracking quality trends over time.

Acceptance criteria:
- `AC-US-05-06-1`: Developer can run the pyramid coverage evaluator from repository tooling.
- `AC-US-05-06-2`: Evaluation generates `agents-results/test-pyramid-coverage-report.md`.
- `AC-US-05-06-3`: Report clearly separates findings for Unit, Integration/API, and UI layers.
- `AC-US-05-06-4`: Report highlights key gaps, warnings, and candidate areas where additional tests are needed.
- `AC-US-05-06-5`: Developer can use report output as input for the coverage-increase workflow in the next iteration.

### US-05-07 Use coverage increase workflow
Persona: Developer

Business details:
- Purpose is to turn coverage findings into practical test additions in controlled batches, instead of trying to fix everything at once.
- Workflow uses explicit approval gates so proposed tests are reviewed before implementation.
- Iterative approach supports predictable quality improvement while keeping risk and change size manageable.

Acceptance criteria:
- `AC-US-05-07-1`: Developer can start coverage-increase workflow using the latest pyramid coverage report as input.
- `AC-US-05-07-2`: Workflow proposes a manageable batch of new tests for review and approval before implementation.
- `AC-US-05-07-3`: After approval, workflow implements agreed tests and updates project test assets accordingly.
- `AC-US-05-07-4`: Workflow reruns coverage analysis after implementation to measure improvement.
- `AC-US-05-07-5`: Workflow updates state/log files in `agents-results` to keep iteration history traceable.

### US-05-08 Perform Playwright locator review
Persona: Developer

Business details:
- Purpose is to keep UI test selectors stable so E2E tests remain reliable as the UI evolves.
- Locator review helps detect fragile selector patterns early (for example selectors tied to unstable text or layout structure).
- Review output provides actionable recommendations and documented findings for future maintenance.

Acceptance criteria:
- `AC-US-05-08-1`: Developer can run locator review workflow after adding or changing Playwright tests/page objects.
- `AC-US-05-08-2`: Review identifies unstable locator patterns and suggests more robust alternatives where needed.
- `AC-US-05-08-3`: Approved locator improvements can be applied to affected Playwright tests/page objects.
- `AC-US-05-08-4`: Review findings are appended to `agents-results/locators-reviewer-results.md` for traceability.

### US-05-09 Keep fault catalog synchronized
Persona: Developer

Acceptance criteria:
- `AC-US-05-09-1`: Fault changes require synchronized updates to docs and seed/active-fault details.
- `AC-US-05-09-2`: Baseline test expectations remain strict under fault policy.

### US-05-10 Manage Swagger/OpenAPI documentation
Persona: Developer

Business details:
- Purpose is to keep API documentation usable for developers, testers, and external consumers.
- Story covers both keeping documentation aligned with API behavior and generating updated Swagger/OpenAPI artifacts.
- Updated API documentation supports easier integration, test design, and change communication.

Acceptance criteria:
- `AC-US-05-10-1`: API changes trigger documentation updates in Swagger/OpenAPI definitions.
- `AC-US-05-10-2`: Developer can generate updated OpenAPI specification file using repository tooling.
- `AC-US-05-10-3`: Generated OpenAPI output reflects current endpoints, parameters, request/response models, and auth requirements.
- `AC-US-05-10-4`: Live Swagger UI and raw OpenAPI JSON endpoints remain available for interactive and machine-readable usage.

### US-05-11 Archive accepted implementation plans
Persona: Developer

Business details:
- Purpose is to preserve key implementation decisions so future changes can be made with full context.
- Archived plans create an auditable history of what was agreed, why it was chosen, and what scope was expected.
- This history reduces repeated discussions, supports onboarding of new team members, and improves continuity across iterations.

Acceptance criteria:
- `AC-US-05-11-1`: Accepted plans can be archived to `docs/plan` with date/topic naming.
- `AC-US-05-11-2`: Archive convention is consistent for future retrieval.

### US-05-12 Use deployment automation
Persona: Developer

Business details:
- Purpose is to deliver frontend and backend changes to shared environments in a repeatable, low-risk way.
- Deployment automation reduces manual release errors and ensures the same release process is used across team members.
- Automated pipelines provide clear release traceability (what was deployed, when, and from which branch/commit).
- Deployment flow also supports operational tasks such as controlled database seeding and post-deploy UI verification.

Acceptance criteria:
- `AC-US-05-12-1`: GitHub Actions provide automated deployment workflows for frontend and backend components.
- `AC-US-05-12-2`: Deployment workflows are triggerable by repository events and support manual operational execution where needed.
- `AC-US-05-12-3`: Dedicated workflow exists for controlled database seeding in deployed environments.
- `AC-US-05-12-4`: Azure DevOps pipeline supports scheduled and manual Playwright E2E runs against deployed URLs.
- `AC-US-05-12-5`: Deployed-environment UI test runs can be executed without starting local web servers.
- `AC-US-05-12-6`: Pipeline outputs provide run history and test/deploy status to support release decisions.

Source: `README.md`, `docker-compose.yaml`, `backend/package.json`, `frontend/package.json`, `frontend/playwright.config.ts`, `.cursor/skills/test-pyramid-coverage-evaluator/SKILL.md`, `.cursor/skills/test-pyramid-coverage-increase/SKILL.md`, `.cursor/skills/playwright-locator-review/SKILL.md`, `.cursor/rules/fault-injection-baseline-tests.mdc`, `.cursor/rules/swagger-openapi-sync.mdc`, `.github/workflows`, `azure-pipelines.yml`
