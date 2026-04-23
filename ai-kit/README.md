# AI Agent Kit (OpenCode compatible)

This folder exports project guidance originally written for Cursor (`.cursor/rules` and `.cursor/skills`) into plain Markdown that can be reused in OpenCode.

## Contents

- `rules/` — portable policy/rule files
- `skills/` — task-specific operating guides

## Exported rules

- `rules/fault-injection-baseline-tests.md`
- `rules/faults-catalog-sync.md`
- `rules/plan-archive-docs.md`
- `rules/readme-cs-sync.md`
- `rules/swagger-openapi-sync.md`

## Exported skills

- `skills/playwright-ui-automation.md`
- `skills/playwright-locator-review.md`
- `skills/test-pyramid-coverage-evaluator.md`
- `skills/test-pyramid-coverage-increase.md`

## How to use in OpenCode

1. Use this README as the base context document.
2. Treat all files under `rules/` as always-on project policy unless your team decides otherwise.
3. For each task, also include one relevant file from `skills/`.
4. Keep baseline tests strict (faults off) and put fault-mode behavior in separate tests.
5. When backend API behavior changes, sync OpenAPI docs in the same task.

## Suggested system prompt snippet

Use the exported policy files in `ai-kit/rules/` as repository constraints.  
For each task, load one or more files from `ai-kit/skills/` that match the requested work.  
Do not relax baseline assertions to accommodate injected faults.  
When API endpoints change, update and verify OpenAPI outputs.

## Source of truth

This export mirrors:

- `.cursor/rules/*.mdc`
- `.cursor/skills/*/SKILL.md`

If those sources change, regenerate this `ai-kit/` folder.
