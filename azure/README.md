# Azure deployment (AI Testing Shop)

By default, [`main.bicep`](main.bicep) deploys:

- **Azure Database for MySQL – Flexible Server**
- **Azure Container Registry** + **Container Apps** (API in [`backend/Dockerfile`](../backend/Dockerfile)) — **no App Service plan**, so **Basic/Free VM quota does not apply**
- **Static Web Apps** (Free) for the Vite frontend

Optional: [`main-appservice.bicep`](main-appservice.bicep) deploys the API on **App Service** (F1/B1) instead — only if your subscription has **App Service** compute quota.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`), logged in (`az login`, `az account set --subscription …`). macOS/Homebrew: `brew install azure-cli`.
- **Container Apps** extension is installed automatically by `deploy.sh` (`az extension add --name containerapp`).

## 1. Provision Azure resources

From the repo root:

```bash
chmod +x azure/deploy.sh
./azure/deploy.sh myshopname
```

This uses **`AZURE_API_HOSTING=containerapp`** by default: Bicep creates MySQL, SWA, Log Analytics, ACR, and a Container Apps environment; the script then builds the API image and runs **`az containerapp create`**.

**Image build:** The script first tries **`az acr build`** (cloud build). If your subscription returns **`TasksOperationsNotAllowed`**, cloud builds are blocked — the script then uses **local Docker** (`docker build --platform linux/amd64` + `docker push`). Install **Docker Desktop**, then re-run `./azure/deploy.sh`. On Apple Silicon, `--platform linux/amd64` is required so the image runs on Azure.

If you build the image elsewhere, push it to your ACR as `…/shop-api:latest` and run with **`AZURE_PREBUILT_API_IMAGE=<full image name>`** so the script skips the build step.

**App Service instead** (if you have Free/Basic App Service quota):

```bash
AZURE_API_HOSTING=appservice AZURE_APP_SERVICE_SKU=F1 ./azure/deploy.sh myshopname
```

Passwords (optional):

```bash
export MYSQL_ADMIN_PASSWORD='yourAlphanumericPassword24chars'
export ADMIN_JWT_SECRET='atLeastSixteenRandomChars'
./azure/deploy.sh myshopname
```

Outputs are also in `azure/.last-deployment.json` (gitignored).

**MySQL password:** use **only letters and digits** so `DATABASE_URL` stays valid.

**Regions:** Defaults **MySQL + API compute** and **Static Web App** in **`westus2`** (many subscriptions cannot create MySQL Flexible Server in **`eastus2`** or **`westeurope`**). SWA Free is only allowed in **`westus2`**, **`centralus`**, **`eastus2`**, **`westeurope`**, **`eastasia`**.

- If MySQL still returns **`ProvisionNotSupportedForRegion`**, try **`AZURE_LOCATION=centralus`** (keep SWA in an allowed region, e.g. `AZURE_SWA_LOCATION=centralus` or `westus2`).
- Split example: `AZURE_LOCATION=northeurope AZURE_SWA_LOCATION=westeurope ./azure/deploy.sh myshopname`

Delete any **failed** MySQL server (or the whole resource group) in the portal before redeploying after a region change.

**Container Apps environment limit:** Many subscriptions allow **only one** **Container Apps managed environment per region**. If Bicep fails with **`MaxNumberOfRegionalEnvironmentsInSubExceeded`**, either:

1. In the [Azure Portal](https://portal.azure.com), open **Container Apps** → **Environments**, delete the extra environment in that region (or delete the whole resource group if you are starting over), then run `./azure/deploy.sh` again; **or**
2. Reuse the environment you already have: copy its **Resource ID** (environment → **Properties**) and run:
   ```bash
   export AZURE_EXISTING_CONTAINER_ENV_ID='/subscriptions/…/resourceGroups/…/providers/Microsoft.App/managedEnvironments/…'
   ./azure/deploy.sh myshopname
   ```
   The template will skip creating a new Log Analytics workspace and environment.

Redeploys with the **same** resource group and **base name** reuse the same **stable** names for MySQL, ACR, Static Web App, and (unless you pass `AZURE_EXISTING_CONTAINER_ENV_ID`) the Container Apps environment—so you do not get a **new** environment on every script run.

**App Service quota (`SubscriptionIsOverQuotaForSku`):** Some subscriptions have **0** for both **Basic** and **Free** App Service VMs. **Do not use `AZURE_API_HOSTING=appservice`** in that case; keep the default **Container Apps** path. If you later get quota, you can switch to App Service with the command above.

## 2. GitHub Actions

| Kind | Name | Value |
|------|------|--------|
| Variable | `VITE_API_BASE_URL` | Printed **`apiUrl`** (`https://….azurecontainerapps.io` or `https://….azurewebsites.net`) |
| Secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Static Web App → **Manage deployment token** |

**App Service only** (when you used `AZURE_API_HOSTING=appservice`):

| Variable / secret | Value |
|-------------------|--------|
| `AZURE_WEBAPP_NAME` | Printed web app name |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | App Service → **Get publish profile** |

The workflow [`.github/workflows/azure-backend.yml`](../.github/workflows/azure-backend.yml) deploys a **zip** to **App Service**. Its deploy job **runs only** when both **`AZURE_WEBAPP_PUBLISH_PROFILE`** (secret) and **`AZURE_WEBAPP_NAME`** (variable) are set; otherwise it is **skipped** (so Container Apps–only setups do not fail on push). For Container Apps, redeploy the API with `./azure/deploy.sh` or add a workflow that builds `backend/Dockerfile` and updates the Container App.

Pushes to `main` still run [`.github/workflows/azure-static-web-app.yml`](../.github/workflows/azure-static-web-app.yml) for the frontend.

## 3. Database migrate and seed

- **Container Apps / Dockerfile:** `prisma migrate deploy` runs before `node dist/index.js` on each container start.
- **App Service:** same via `npm run start:azure`.

**Seed** (optional): allow your IP on MySQL (portal **Networking** or `DEV_CLIENT_IP` on deploy), then:

```bash
export DATABASE_URL='mysql://shopadmin:PASSWORD@HOST.mysql.database.azure.com:3306/ai_testing_shop?sslaccept=strict'
cd backend && npx prisma migrate deploy && npm run prisma:seed
```

## 4. Smoke test

- `GET {apiUrl}/health` → `{ "status": "ok" }`
- Open the Static Web App URL; the shop should call the API (check the browser Network tab).

## CORS and local development

Locally, `NODE_ENV` is not `production`, so the API allows `http://localhost:5173` and `http://127.0.0.1:5173` and merges `CORS_ORIGINS`. In production, only `CORS_ORIGINS` is used (set on the Container App / App Service from the Static Web App URL).

## Frontend API URL

Production builds use **`VITE_API_BASE_URL`** (GitHub variable). Local dev defaults to `http://localhost:4000` when unset.
