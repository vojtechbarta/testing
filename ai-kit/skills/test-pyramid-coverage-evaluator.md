# Test pyramid coverage evaluator (this project)

## Purpose

Generate an on-demand report for:

- Unit coverage depth (line/function/branch)
- Integration/API endpoint and flow coverage
- UI E2E flow quality (short independent flows)

Output:

- `agents-results/test-pyramid-coverage-report.md`

## Run

From repository root:

```bash
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs
```

Optional custom output:

```bash
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs --out agents-results/my-custom-report.md
```

## What it checks

1. Unit
   - Runs backend Vitest coverage for service unit tests
   - Reads summary metrics
   - Compares with warning targets:
     - line >= 95%
     - function >= 95%
     - branch >= 90%

2. Integration/API
   - Discovers endpoints from route files and mounts
   - Detects endpoint usage in integration tests
   - Produces endpoint coverage matrix and missing-category proposals

3. UI
   - Scans Playwright specs in `frontend/e2e/tests`
   - Uses heuristics for short/independent flow quality
   - Flags missing journeys and over-coupled tests

## Notes

- Advisory tool: does not fail CI by itself.
- If coverage tooling is blocked, report should explain blockers.
