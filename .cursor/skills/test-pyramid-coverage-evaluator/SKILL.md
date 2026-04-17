---
name: test-pyramid-coverage-evaluator
description: >-
  Evaluates test pyramid coverage for this repository across Unit, Integration/API,
  and UI levels, then generates a markdown report with warnings, missing tests,
  and implementation proposals in agents-results/test-pyramid-coverage-report.md.
  Use when the user asks for pyramid coverage analysis, test coverage report, or
  recommends which tests are missing per level.
---

# Test pyramid coverage evaluator (this project)

## Purpose

Generate an on-demand report for:
- Unit coverage depth (line/function/branch).
- Integration/API endpoint and flow coverage.
- UI E2E flow quality (short independent flows).

Output file:
- [`agents-results/test-pyramid-coverage-report.md`](../../../agents-results/test-pyramid-coverage-report.md)

## Run

From repository root:

```bash
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs
```

Optional custom output path:

```bash
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs --out agents-results/my-custom-report.md
```

## What the generator checks

1. **Unit**
   - Runs backend Vitest coverage for service unit tests.
   - Reads summary metrics (lines/functions/branches/statements).
   - Compares with warning targets:
     - line >= 95%
     - function >= 95%
     - branch >= 90%
   - For any warning, includes:
     - `Warning`
     - `Missing Tests`
     - `Implementation Proposal`
     - `Suggested File Placement`

2. **Integration/API**
   - Discovers API endpoints from backend route files and app mounts.
   - Detects endpoint usage in integration test files.
   - Builds endpoint matrix with coverage status.
   - Flags missing positive/params/error/auth categories for uncovered routes.
   - Produces implementation proposals for missing route coverage.

3. **UI**
   - Scans Playwright specs in `frontend/e2e/tests`.
   - Counts tests and checks whether flows are short/independent using heuristics:
     - per-test setup (`goto`/new page object),
     - cleanup usage,
     - long chained scenario indicators.
   - Warns about missing user journeys and over-coupled tests.

## Notes

- This evaluator is advisory; it does not fail CI by itself.
- If coverage tooling is unavailable, the report still generates and explains the blocker.
- Keep this skill focused on reporting. Test implementation remains a separate task.
