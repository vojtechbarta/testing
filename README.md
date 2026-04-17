# AI Testing Shop

English | [Čeština](README.cs.md)

Demo e-shop (React + Node) designed as a **training playground** for testing: catalog, browser-session cart, checkout, product admin, tester role for **fault injection**, mock payment gateway, and JSON-based payment outcome configuration.

---

## Repository structure

| Folder | Purpose |
|--------|---------|
| **`frontend/`** | React (Vite), shop UI, admin/tester panels, API calls |
| **`backend/`** | Express API, Prisma + MySQL, business logic, e-mail (optional) |
| **`backend/prisma/`** | DB schema, migrations, `seed.ts` (users, products, fault configs) |
| **`backend/MockConfigs/`** | Files outside DB (e.g., mock payment outcomes by e-mail) — see [`backend/MockConfigs/README.md`](backend/MockConfigs/README.md) |
| **`docker-compose.yaml`** | MySQL 8.4 in Docker (optional DB for local development) |
| **`azure/`** | Bicep templates, [`azure/deploy.sh`](azure/deploy.sh) script — MySQL, Static Web App, API (Container Apps or App Service). Details: [`azure/README.md`](azure/README.md) |

### Where things are in backend (simplified)

- **`src/app.ts`** – builds the Express app (`createApp()`, without `listen`) — used by tests and server.
- **`src/index.ts`** – starts server on `PORT` (default 4000).
- **`src/routes/`** – HTTP endpoints (`/products`, `/cart`, `/checkout`, `/auth`, `/admin/...`, `/faults/...`, `/exchange-rates`).
- **`src/services/`** – domain logic (cart, checkout, products, e-mail, mock payments, ...).
- **`src/faults/`** – runtime fault injection (UI/API/Unit levels, cache, invalidation after admin changes).
- **`src/middleware/adminAuth.ts`** – JWT auth for admin/tester API.
- **`src/utils/cartSession.ts`** – validation of `X-Cart-Session` header (UUID).
- **`src/integration-tests/`** – integration / **internal API** tests (Supertest + real DB).
- **`src/services/unit-tests/`** – service **unit** tests (Vitest + mocked Prisma).

### Where things are in frontend

- **`src/App.tsx`** – main UI (shop, cart, checkout, admin, bugs tab, CSV export of products and cart).
- **`src/api/`** – fetch clients (`cart`, `checkout`, `products`, `admin`, `faults`, ...).
- **`src/lib/cartSession.ts`** – `sessionStorage` + cart session UUID (`X-Cart-Session`).
- **`e2e/`** – Playwright: `tests/*.spec.ts`, `pages/` (page objects). Docs: [`frontend/e2e/README.md`](frontend/e2e/README.md).

---

## Requirements

- **Node.js** (version according to your environment; project uses current npm scripts).
- **MySQL** — local instance or Docker Compose container (see below).
- **Docker Desktop** (or another Docker engine) — only if you want DB in a container.
- (Optional E2E) **Chromium** for Playwright: `cd frontend && npx playwright install chromium`.

---

## Docker (MySQL)

At repository root there is [`docker-compose.yaml`](docker-compose.yaml): service **`db`** (image **MySQL 8.4**), container `ai-testing-shop-db`. The app itself (Node backend / Vite frontend) is **not** in compose — you still run it directly via `npm run dev`; Docker mainly provides DB without local MySQL installation.

### Start database

From the directory where `docker-compose.yaml` lives (project root **`Testing/`**):

```bash
docker compose up -d
```

Verify it is running:

```bash
docker compose ps
# or
docker logs ai-testing-shop-db --tail 20
```

Default access (must match `DATABASE_URL` in `backend/.env`):

| Item | Value |
|------|-------|
| Host from host machine | `localhost` |
| Port | `3306` |
| Database | `ai_testing_shop` |
| User | `root` |
| Password | `password` |

Example `backend/.env` with this compose setup:

```env
DATABASE_URL="mysql://root:password@localhost:3306/ai_testing_shop"
```

Then from `backend/` as usual: `npx prisma migrate deploy` and `npm run prisma:seed`.

### Stop

```bash
docker compose stop          # stop containers
docker compose down          # stop and remove containers (data volume remains)
docker compose down -v       # also remove volume -> empty DB on next `up`
```

**Port 3306 conflict:** if you already run local MySQL, either stop it or change port mapping in `docker-compose.yaml` (e.g. `"3307:3306"`) and use `localhost:3307` in `DATABASE_URL`.

---

## First run (local)

### 1. Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Database and seed

Set in `backend/.env`, for example:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/DB_NAME"
```

Migrate and seed (from **`backend/`**):

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Seed creates, among other things:

- **Admin:** `admin` / `admin` (e-mail `admin@example.com`)
- **Tester:** `tester` / `tester` (e-mail `tester@example.com`)
- 15 realistic products with default stock of 10 each
- `FaultConfig` records (typically **disabled** by default)

### 3. Run the app

**Two terminals** (standard dev flow):

```bash
# Terminal 1 - API on http://localhost:4000
cd backend && npm run dev

# Terminal 2 - UI on http://localhost:5173
cd frontend && npm run dev
```

In browser open **http://localhost:5173** (or `http://127.0.0.1:5173`).

**"Failed to fetch" in dev mode:** API must run on **:4000** before opening UI. In development, Vite **proxy** forwards `/products`, `/cart`, `/auth`, ... to backend, so browser calls the same origin as the page and does not depend on `localhost` vs `127.0.0.1` matching. In non-production backend, CORS is configured as **dynamic origin** (`origin: true`).

### API docs (Swagger / OpenAPI)

After backend starts:

- **Swagger UI:** `http://localhost:4000/docs`
- **Raw OpenAPI JSON:** `http://localhost:4000/docs-json`

On Azure, Swagger is available at your deployed API URL, for example:

- **Swagger UI (Azure):** `https://myshopname-api-nrpgzs.icyisland-9b0231d6.westus2.azurecontainerapps.io/docs/`

The spec is generated from OpenAPI annotations directly in route files (`backend/src/routes/*.ts`).

Optionally export a static file:

```bash
cd backend
npm run docs:openapi   # creates backend/openapi.json
```

---

## Tests

### Backend - Vitest (`backend/`)

| Type | Directory | Description |
|------|-----------|-------------|
| **Unit** | `backend/src/services/unit-tests/` | Services with mocked Prisma; fast, no HTTP and no DB required for most tests that mock DB. |
| **Internal API (integration)** | `backend/src/integration-tests/` | Supertest against `createApp()`, **real MySQL** from `.env`; validates endpoint contracts similar to Postman. |

**Run:**

```bash
cd backend
npm test              # run all tests once
npm run test:watch    # interactive mode
```

**Single file only (example):**

```bash
cd backend
npx vitest run src/integration-tests/internalApi.integration.test.ts
```

**Integration API tests** need DB connectivity and seeded data (at least one active product).  
**Note:** If cart quantity-doubling faults (API/Unit) are **enabled**, cart assertions in integration tests can fail — disable those faults in admin or re-run `npm run prisma:seed` according to your seed setup.

### Frontend - Playwright E2E (`frontend/`)

Tests are in `frontend/e2e/tests/`; config is in `frontend/playwright.config.ts` (can auto-start backend + Vite via `npm run dev:e2e` unless `SKIP_WEBSERVER=1`).

```bash
cd frontend
npm run test:e2e           # headless
npm run test:e2e:headed    # headed browser
npm run test:e2e:ui        # Playwright UI
npm run test:e2e:report    # latest HTML report
```

Details: [`frontend/e2e/README.md`](frontend/e2e/README.md).

---

## AI Agent Coverage Workflow

Two project skills automate test-pyramid coverage analysis and iterative test improvements:

- **Evaluator:** [`.cursor/skills/test-pyramid-coverage-evaluator/SKILL.md`](.cursor/skills/test-pyramid-coverage-evaluator/SKILL.md)
  - Generates latest pyramid coverage report (Unit / Integration/API / UI).
- **Increase loop:** [`.cursor/skills/test-pyramid-coverage-increase/SKILL.md`](.cursor/skills/test-pyramid-coverage-increase/SKILL.md)
  - Proposes the next medium batch of tests (4-8), waits for explicit approval, then implementation can continue in the next loop iteration.

Canonical outputs in `agents-results/`:

- `test-pyramid-coverage-report.md` - latest coverage evaluation snapshot
- `test-pyramid-coverage-increase-log.md` - approval/proposal history
- `test-pyramid-coverage-increase-state.json` - loop state for automation

Typical command flow (from repo root):

```bash
# 1) Recompute latest coverage report
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs

# 2) Propose next test batch
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --propose

# 3) Approve current proposal
node .cursor/skills/test-pyramid-coverage-increase/scripts/increase-coverage.mjs --approve

# 4) (Agent implements approved tests), then rerun evaluator
node .cursor/skills/test-pyramid-coverage-evaluator/scripts/generate-report.mjs
```

Git policy for `agents-results/`:

- Tracked: `test-pyramid-coverage-report.md`, `test-pyramid-coverage-increase-log.md`, `locators-reviewer-results.md`
- Ignored: `test-pyramid-coverage-increase-state.json` (ephemeral automation state)

---

## Important concepts

- **Cart** is bound to a **session** (`X-Cart-Session` + `sessionStorage` in frontend), not to one global DB user — each tab / Playwright context has its own cart.
- **Fault injection** — faults can be enabled in DB/UI (UI / API / Unit levels); intended for test training and regression simulation.
- **CORS:** in production, allowed origins come from `CORS_ORIGINS`; in development it uses **`origin: true`** (any local origin). In development, Vite also **proxies** API paths to `127.0.0.1:4000`. Headers include `Authorization`, `X-Cart-Session`, ...

---

## Build (production artifacts)

```bash
cd backend && npm run build    # TypeScript -> dist/
cd ../frontend && npm run build
```

---

## Deployment to Azure

Production setup is **split into two parts**: frontend on **Azure Static Web Apps** (SWA) and backend on **Azure Container Apps** + **Azure Database for MySQL - Flexible Server** + **Azure Container Registry** (ACR). Default path **does not use App Service** (no Free/Basic VM plan quota needed).

Optionally, API can run on **Azure App Service** (F1/B1) — see [`azure/main-appservice.bicep`](azure/main-appservice.bicep) and `AZURE_API_HOSTING` variable.

### Architecture (summary)

| Component | Purpose |
|-----------|---------|
| **Static Web App** | Built Vite frontend; public HTTPS URL. |
| **Container App** (default) | Docker image from [`backend/Dockerfile`](backend/Dockerfile); container startup runs `npx prisma migrate deploy` and then `node dist/index.js` on port **4000**. |
| **MySQL Flexible Server** | Database `ai_testing_shop`, user `shopadmin` (password from deployment). |
| **ACR** | Registry for `shop-api:latest` image. |

**`VITE_API_BASE_URL`** must point to HTTPS API URL in production frontend build (without trailing slash). Locally, default remains `http://localhost:4000` if not set.

**CORS:** in production backend uses **`CORS_ORIGINS`** (set by Bicep/deploy from Static Web App URL). Locally it also allows `localhost:5173` and `127.0.0.1:5173`.

### Quick start (Azure CLI)

Requirements: [**Azure CLI**](https://learn.microsoft.com/cli/azure/install-azure-cli) installed, logged in (`az login`), suitable subscription.

From repository root:

```bash
chmod +x azure/deploy.sh
./azure/deploy.sh <short-name>
```

`<short-name>` (e.g. `myshop`) is used as the base for resource names. Script:

1. Creates or reuses resource group (default `AZURE_RG=rg-ai-testing-shop`).
2. Deploys Bicep ([`azure/main.bicep`](azure/main.bicep), or when `AZURE_API_HOSTING=appservice`, [`azure/main-appservice.bicep`](azure/main-appservice.bicep)).
3. For **Container Apps**: tries **`az acr build`**; on **TasksOperationsNotAllowed** it falls back to **local Docker** (`linux/amd64` + `docker push`). Image can be prebuilt and passed as **`AZURE_PREBUILT_API_IMAGE`**.
4. Creates or updates Container App / App Service and prints **`apiUrl`** and **`staticWebAppUrl`**.

Important **environment variables** (optional, see also [`azure/README.md`](azure/README.md)):

| Variable | Meaning |
|----------|---------|
| `AZURE_RG` | Resource group name (default `rg-ai-testing-shop`). |
| `AZURE_LOCATION` | Region for MySQL, ACR, Container Apps (default `westus2`). |
| `AZURE_SWA_LOCATION` | Static Web App region - must be supported (e.g. `westus2`, `westeurope`). |
| `AZURE_API_HOSTING` | `containerapp` (default) or `appservice`. |
| `AZURE_APP_SERVICE_SKU` | For App Service: `F1` or `B1`. |
| `MYSQL_ADMIN_PASSWORD` / `ADMIN_JWT_SECRET` | Optional fixed values (MySQL password should be alphanumeric due to `DATABASE_URL`). |
| `DEV_CLIENT_IP` | Public IP for MySQL firewall rule (dev from laptop). |
| `AZURE_EXISTING_CONTAINER_ENV_ID` | Existing Container Apps Environment ID (some subscriptions limit one env per region). |
| `AZURE_PREBUILT_API_IMAGE` | Full image name in ACR if you do not want script build. |

Last deployment output is also in `azure/.last-deployment.json` (file is in `.gitignore`).

### GitHub Actions

- **Frontend** - workflow [`.github/workflows/azure-static-web-app.yml`](.github/workflows/azure-static-web-app.yml): on push to `main` (changes in `frontend/`) it builds and deploys SWA.  
  - **Repository variable:** `VITE_API_BASE_URL` = `apiUrl` from deploy script output (e.g. `https://....azurecontainerapps.io`).  
  - **Secret:** `AZURE_STATIC_WEB_APPS_API_TOKEN` - token from Static Web App portal (*Manage deployment token*).

- **Backend on Container Apps** - workflow [`.github/workflows/azure-backend.yml`](.github/workflows/azure-backend.yml) runs on push to `main` (changes in `backend/**`, `azure/**`, or workflow file) and deploys API via `azure/deploy.sh`.
  - **Secret:** `AZURE_CREDENTIALS` (service principal JSON for `azure/login`)
  - **Secret:** `MYSQL_ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`
  - **Variables:** `AZURE_BASE_NAME`, `AZURE_RG`, `AZURE_LOCATION`, `AZURE_SWA_LOCATION`
  - Optional: `AZURE_EXISTING_CONTAINER_ENV_ID`, `AZURE_PREBUILT_API_IMAGE`, `DEV_CLIENT_IP`

- **Manual DB seed** - workflow [`.github/workflows/azure-seed.yml`](.github/workflows/azure-seed.yml) is run manually (`workflow_dispatch`) and requires `RESET` confirmation. It runs `prisma migrate deploy` + `npm run prisma:seed` against Azure MySQL.

### Database: migrations and seed

- Migrations in **Container Apps** run automatically at container startup (see `CMD` in [`backend/Dockerfile`](backend/Dockerfile)).
- **Seed** (products, admin/tester users, ...) is **not automatic**. Run once from a machine with allowed IP in MySQL firewall:

```bash
export DATABASE_URL='mysql://shopadmin:<HESLO>@<HOST>.mysql.database.azure.com:3306/ai_testing_shop?sslaccept=strict'
cd backend && npx prisma migrate deploy && npm run prisma:seed
```

`DATABASE_URL` for Azure MySQL must include **`?sslaccept=strict`** (not CLI `mysql` client syntax).

### Post-deploy verification

- `GET {apiUrl}/health` -> JSON with `"status":"ok"`.
- Open Static Web App URL; in browser network tab verify API calls target `VITE_API_BASE_URL`.

### Details and troubleshooting

Full guide (regions, quotas, ACR build vs Docker, Container Apps environment limits, CORS) is in **[`azure/README.md`](azure/README.md)**.

---

## More docs in repo

- [`azure/README.md`](azure/README.md) - Azure: Bicep, `deploy.sh`, GitHub Actions, DB, troubleshooting  
- [`azure/RUNBOOK.md`](azure/RUNBOOK.md) - practical operations runbook (deploy/seed incidents)  
- [`frontend/e2e/README.md`](frontend/e2e/README.md) - E2E commands, CORS, test structure  
- [`backend/MockConfigs/README.md`](backend/MockConfigs/README.md) - mock payment outcomes by buyer e-mail  
- Playwright (Cursor skills): E2E authoring [`.cursor/skills/playwright-ui-automation/SKILL.md`](.cursor/skills/playwright-ui-automation/SKILL.md), locator review [`.cursor/skills/playwright-locator-review/SKILL.md`](.cursor/skills/playwright-locator-review/SKILL.md)  

---

## License / copyright

According to `package.json` settings in each package (backend `ISC`).
