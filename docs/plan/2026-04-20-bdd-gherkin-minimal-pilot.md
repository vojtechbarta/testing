Archived: 2026-04-20

# Minimal BDD pilot plan (separate branch)

## Scope

Run a small proof-of-concept only:

- one frontend Gherkin scenario mapped to existing Playwright behavior
- one backend Gherkin scenario mapped to existing integration behavior
- no migration of existing test suites yet

Reference files to mirror:

- [`frontend/e2e/tests/shop.spec.ts`](frontend/e2e/tests/shop.spec.ts)
- [`backend/src/integration-tests/internalApi.integration.test.ts`](backend/src/integration-tests/internalApi.integration.test.ts)
- [`frontend/playwright.config.ts`](frontend/playwright.config.ts)
- [`backend/vitest.config.ts`](backend/vitest.config.ts)

## Branch and delivery model

1. Create a dedicated branch, e.g. `experiment/bdd-minimal-pilot`.
2. Add only pilot artifacts and scripts in that branch.
3. Keep `main` behavior unchanged until pilot evaluation is accepted.

## Pilot scenarios

1. UI pilot
   - Feature: `MoreIsLess promo can be applied and cleared`
   - Keep scenario short and deterministic.
2. API pilot
   - Feature: `Volume discount baseline tiers`
   - Baseline assertions only: `2 -> 10%`, `3 -> 15%`, `4+ -> 20%`.

## Implementation outline

1. Add BDD tooling with isolated commands:
   - `test:bdd:e2e`
   - `test:bdd:api`
2. Add minimal feature files and step definitions for the 2 pilot scenarios.
3. Reuse existing page objects/helpers and API setup patterns where possible.
4. Run pilots locally and capture runtime/flakiness/maintenance observations.

## Guardrails

- Do not replace or weaken existing baseline tests.
- Keep fault-injection scenarios separate from baseline BDD scenario.
- Keep BDD to acceptance-level behavior only; technical edge cases stay in existing tests.

## Success criteria

- Both pilot scenarios pass locally.
- Existing Playwright and Vitest tests still pass unchanged.
- Team can read and understand the Gherkin scenarios.
- A clear decision is documented: expand BDD or stop after pilot.
