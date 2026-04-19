Archived: 2026-04-19

# Azure DevOps pipeline: nightly / manual UI tests against deployed app

## Overview

Add an Azure DevOps pipeline that runs Playwright against a stable deployed frontend URL on a schedule and on demand, publishes JUnit/HTML artifacts, and optionally coordinates with the existing GitHub-hosted seed workflow—or skips seed for fault-injection experiments.

## Implemented in repo

- [`frontend/playwright.config.ts`](../../frontend/playwright.config.ts) — JUnit report `playwright-junit.xml` when `CI` is set (for `PublishTestResults@2`).
- [`frontend/package.json`](../../frontend/package.json) — script `test:e2e:deployed` (no local `prisma:seed`).
- [`frontend/e2e/README.md`](../../frontend/e2e/README.md) — “Deployed environment” section (env vars + example).
- [`azure-pipelines.yml`](../../azure-pipelines.yml) — schedule (21:00 UTC default, adjust as needed), parameter `smokeOnly`, validation, publish tests + artifact.

## Manual Azure DevOps setup (not in repo)

1. Create a pipeline from the YAML file in this repository.
2. Define pipeline variables `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_API_BASE_URL` (or a variable group).
3. Ensure the backend `CORS_ORIGINS` includes the Static Web App origin.
4. If scheduled runs do not fire, enable permissions for the **Build / Project** collection to use the service account for scheduled builds (Project settings → Pipelines → Settings).

## Seed strategy

- Nightly deterministic data: run [`.github/workflows/azure-seed.yml`](../../.github/workflows/azure-seed.yml) before the test window, or add a separate ADO job later (requires MySQL reachability from the agent).
- Fault-injection experiments: skip seed so the DB keeps non-default fault state; use `smokeOnly` or narrow `grep` as needed.
