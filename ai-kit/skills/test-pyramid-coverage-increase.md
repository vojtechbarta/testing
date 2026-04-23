# Test pyramid coverage increase (this project)

## Purpose

Drive coverage improvement in an approval-gated loop:

1. Parse current coverage report.
2. Propose next 4-8 tests.
3. Wait for explicit user approval.
4. Implement approved tests.
5. Rerun coverage evaluator.
6. Repeat while warnings remain.

## Inputs and outputs

- Input report:
  - `agents-results/test-pyramid-coverage-report.md`
- Loop state:
  - `agents-results/test-pyramid-coverage-increase-state.json`
- Human log:
  - `agents-results/test-pyramid-coverage-increase-log.md`

## Commands

From repository root:

```bash
# Build next proposal batch (no code changes)
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --propose

# Mark current proposal approved
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --approve

# Show current proposal/state
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --status
```

After implementation, rerun evaluator:

```bash
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs
```

## Batch policy

- Medium batch only: 4-8 tests.
- Priority:
  1. Unit gaps affecting branch/function metrics.
  2. Integration/API uncovered endpoints and categories.
  3. UI missing short independent flows.

## Stop conditions

- No threshold warnings remain in evaluator report.
- Or user explicitly stops.
