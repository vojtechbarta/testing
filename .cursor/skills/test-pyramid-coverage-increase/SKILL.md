---
name: test-pyramid-coverage-increase
description: >-
  Proposes and executes iterative test additions to increase pyramid coverage.
  It reads agents-results/test-pyramid-coverage-report.md, proposes a medium
  batch (4-8 tests), pauses for explicit user approval each iteration, then
  implements approved tests, reruns the evaluator, and repeats until thresholds
  are met or user stops.
---

# Test pyramid coverage increase (this project)

## Purpose

Drive coverage improvement in an approval-gated loop:
1. Parse current coverage report.
2. Propose next 4-8 tests.
3. Wait for explicit user approval.
4. Implement approved tests.
5. Rerun coverage evaluator.
6. Repeat if warnings remain.

## Inputs and outputs

- Input report:
  - [`agents-results/test-pyramid-coverage-report.md`](../../../agents-results/test-pyramid-coverage-report.md)
- Loop state:
  - [`agents-results/test-pyramid-coverage-increase-state.json`](../../../agents-results/test-pyramid-coverage-increase-state.json)
- Human log:
  - [`agents-results/test-pyramid-coverage-increase-log.md`](../../../agents-results/test-pyramid-coverage-increase-log.md)

## Commands

From repository root:

```bash
# Build next proposal batch (no code changes)
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --propose

# Mark current proposal approved (approval checkpoint)
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --approve

# Show current state and latest proposal
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --status
```

## Operating model

- Proposal generation is deterministic from current report.
- Approval is mandatory each iteration.
- After approval, the agent implements the approved batch in code.
- After implementation, run evaluator:

```bash
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs
```

- Then run `--propose` again for next batch.

## Batch policy

- Medium batch only: 4-8 tests.
- Priority order:
  1. Unit gaps hurting branch/function metrics.
  2. Integration/API uncovered endpoints with auth/error categories.
  3. UI missing short independent user flows.

## Stop conditions

- Evaluator report has no threshold warnings.
- Or user explicitly stops the loop.
