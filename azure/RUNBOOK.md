# Azure ops runbook (deploy + seed)

This runbook is a practical checklist for the most common production tasks and failures in this project.

## 1) One-time GitHub setup

Set these GitHub Actions values:

- Secrets: `AZURE_CREDENTIALS`, `MYSQL_ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`
- Variables: `AZURE_RG`, `AZURE_BASE_NAME`, `AZURE_LOCATION`, `AZURE_SWA_LOCATION`
- Recommended variables: `AZURE_EXISTING_CONTAINER_ENV_ID`, `AZURE_MYSQL_FQDN`

Notes:

- `AZURE_MYSQL_FQDN` prevents seeding the wrong DB host.
- `AZURE_EXISTING_CONTAINER_ENV_ID` avoids Container Apps regional environment quota issues.

## 2) Standard release flow

1. Push backend/infrastructure changes to `main` (workflow: `azure-backend.yml`).
2. Verify backend health: `GET {apiUrl}/health` => `{"status":"ok"}`.
3. If catalog/test data changed, run manual seed workflow (`azure-seed.yml`) with `confirm_reset=RESET`.
4. Verify products endpoint and UI.

## 3) Verify data path quickly

Use the same API host your frontend calls:

```bash
curl -s "https://<api-host>/products"
```

If this does not match expected data, verify that Container App and seed target the same DB host.

## 4) Common incidents

### A) Seed workflow succeeds, UI still shows old products

Symptoms:

- Seed logs show inserts/updates.
- `/products` still returns old catalog.

Checks:

1. Confirm frontend points to expected API (`VITE_API_BASE_URL` + browser Network tab).
2. Confirm Container App revision is recent:
   ```bash
   az containerapp revision list -g "$AZURE_RG" -n "<app-name>" --query "[].{name:name,active:properties.active,created:properties.createdTime}" -o table
   ```
3. Confirm Container App uses `DATABASE_URL` via `secretRef`:
   ```bash
   az containerapp show -g "$AZURE_RG" -n "<app-name>" --query "properties.template.containers[0].env[?name=='DATABASE_URL']" -o json
   ```

Fix:

- Update `database-url` secret to correct host/password.
- Force new revision:
  ```bash
  az containerapp update -g "$AZURE_RG" -n "<app-name>" --set-env-vars "DATABASE_URL=secretref:database-url"
  ```

### B) `P1001 Can't reach database server`

Checks:

- MySQL state `Ready`, public access `Enabled`.
- Firewall has your public IP and Azure services rule (`0.0.0.0`).

### C) `P1000 Authentication failed`

Cause:

- Wrong MySQL admin password in `DATABASE_URL` or stale `MYSQL_ADMIN_PASSWORD` secret.

Fix:

- Reset MySQL admin password and update:
  - local `DATABASE_URL`
  - GitHub secret `MYSQL_ADMIN_PASSWORD`
  - Container App `database-url` secret

### D) `MaxNumberOfRegionalEnvironmentsInSubExceeded`

Fix:

- Reuse existing Container Apps environment via `AZURE_EXISTING_CONTAINER_ENV_ID`.

## 5) Safe operating rules

- Do not run seed automatically on every deploy (it rewrites test data).
- Keep seed as manual workflow with explicit confirmation (`RESET`).
- Keep `backend/.env` out of git (already ignored).
- After changing DB credentials, update all three locations:
  1. local `backend/.env` / runtime `DATABASE_URL`
  2. GitHub secrets
  3. Container App secret `database-url`
