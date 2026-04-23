Archived: 2026-04-23

# CI Prisma migration validation

**Overview:** Local verify script + npm command, a **Cursor rule** on `backend/prisma/**` so agents run the check before finishing migration work, GitHub Actions `migrate deploy`, optional baseline upgrade path later.

## Todos (execution)

- Add GitHub Actions workflow with MySQL service and `prisma migrate deploy` on backend/prisma changes.
- Scope workflow triggers to prisma and backend package changes; document in workflow comments.
- Document local pre-push migration check and CI behavior in README (1 short section).
- Add `backend/scripts/verify-migrations.local.sh` (or similar) + `npm run prisma:migrate:verify` — primary local workflow (empty test DB + `migrate deploy` / `status`); document env in script/README.
- Add `.cursor/rules/prisma-migration-verify.mdc` with `globs: backend/prisma/**` — before finishing migration/schema edits, run verify (or tell human / rely on CI if DB unavailable).
- Optional phase 2: upgrade-path test with checked-in baseline SQL or release-tagged schema.

## Goal

- **Local (first):** developers run the same validation **before push** on a throwaway empty MySQL database, so SQL errors surface without waiting for CI.
- **CI (second):** relevant PR/push runs the same `prisma migrate deploy` in GitHub Actions.
- **Prod alignment:** both match Azure startup (`prisma migrate deploy` in `start:azure` → `backend/package.json`).

## Local developer workflow (before push)

**Primary path:** `npm run prisma:migrate:verify` from `backend/` (exact name TBD during implementation). Prerequisite: MySQL 8 already running and reachable.

**What the script automates** (manual steps only when debugging):

1. Fail fast if MySQL is not reachable (optional).
2. Create or reset a **dedicated empty database** (e.g. `migration_test`) — never the daily dev database.
3. Run Prisma with `DATABASE_URL` pointing only at that DB for the subprocess (do not overwrite the developer’s normal `.env`).
4. `prisma migrate deploy` then `prisma migrate status`.

README documents the single command, prerequisite, and env overrides (e.g. base URL if the script appends the DB name).

## Cursor rule (agent assurance)

New rule **prisma-migration-verify** (same style as `swagger-openapi-sync`): when matching files under `backend/prisma/**` are in scope, the agent runs `npm run prisma:migrate:verify` before considering work complete (MySQL must be running). Rules **do not** replace CI or force every human to run commands; **CI** is the team-wide gate. Optional later: git pre-push / Husky — not in v1 unless requested.

## Why this helps

- **Fresh DB deploy:** invalid SQL, missing columns, bad index names, wrong ordering.
- **Upgrade path (phase 2):** migrations that assume partial prior state or non-idempotent `DROP INDEX`.

## Proposed CI — Job A (mandatory)

- Trigger: `pull_request` / `push` to `main`, paths: `backend/prisma/**`, `backend/package.json`, workflow file.
- Service: MySQL 8.x; `cd backend && npm ci`; empty DB `DATABASE_URL`; `npx prisma migrate deploy`; optional `prisma migrate status`.

## Proposed CI — Job B (optional phase 2)

Baseline SQL in repo or tagged schema → restore → apply only newer migrations.

## Files to add or touch

- `.github/workflows/prisma-migrations.yml` (name flexible).
- `README.md`: section **Migration checks** — `npm run prisma:migrate:verify` + CI when `backend/prisma/**` changes.
- `backend/package.json` + `backend/scripts/` — required for the local workflow (not optional).
- `.cursor/rules/prisma-migration-verify.mdc`

## Guardrails

- Never use production `DATABASE_URL` in Actions.
- Keep job fast: `npm ci` cache, no seed unless required.

## Success criteria

- Developer can apply all migrations on an empty DB locally before push.
- Agents editing Prisma migrations/schema get the Cursor rule reminder to verify.
- Broken migration SQL fails CI with a clear `prisma migrate deploy` error.

## Out of scope

- Fixing already-broken prod DBs; full data backfill validation (v1 is schema/migration apply only).

## Plan source

Working copy may also exist under Cursor plans as `ci-prisma-migration-tests_0c63996f.plan.md`.
