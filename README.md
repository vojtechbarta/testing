# AI Testing Shop

Demo e‑shop (React + Node) určený jako **tréninkové hřiště** pro testování: katalog, košík podle relace prohlížeče, checkout, admin produktů, role tester pro **fault injection**, mock platební brána a konfigurace výsledků platby přes JSON.

---

## Struktura repozitáře

| Složka | Účel |
|--------|------|
| **`frontend/`** | React (Vite), shop UI, admin/tester panely, volání API |
| **`backend/`** | Express API, Prisma + MySQL, business logika, e‑mail (volitelně) |
| **`backend/prisma/`** | Schéma DB, migrace, `seed.ts` (uživatelé, produkty, fault konfigurace) |
| **`backend/MockConfigs/`** | Soubory mimo DB (např. výsledky mock platby podle e‑mailu) — viz [`backend/MockConfigs/README.md`](backend/MockConfigs/README.md) |
| **`docker-compose.yaml`** | MySQL 8.4 v Dockeru (volitelná DB pro lokální vývoj) |
| **`azure/`** | Bicep šablony, skript [`azure/deploy.sh`](azure/deploy.sh) — MySQL, Static Web App, API (Container Apps nebo App Service). Podrobnosti: [`azure/README.md`](azure/README.md) |

### Kde je co v backendu (zjednodušeně)

- **`src/app.ts`** – sestavení Express aplikace (`createApp()`, bez `listen`) – pro testy i server.
- **`src/index.ts`** – spuštění serveru na `PORT` (default 4000).
- **`src/routes/`** – HTTP endpointy (`/products`, `/cart`, `/checkout`, `/auth`, `/admin/...`, `/faults/...`).
- **`src/services/`** – doménová logika (košík, checkout, produkty, e‑mail, mock platby, …).
- **`src/faults/`** – runtime injekce chyb (UI/API/Unit úrovně, cache, invalidace po změně v adminu).
- **`src/middleware/adminAuth.ts`** – JWT pro admin/tester API.
- **`src/utils/cartSession.ts`** – validace hlavičky `X-Cart-Session` (UUID).
- **`src/integration-tests/`** – integrační / **internal API** testy (Supertest + reálná DB).
- **`src/services/unit-tests/`** – **unit** testy služeb (Vitest + mocknuté Prisma).

### Kde je co ve frontendu

- **`src/App.tsx`** – hlavní UI (shop, košík, checkout, admin, záložka bugs).
- **`src/api/`** – fetch klienti (`cart`, `checkout`, `products`, `admin`, `faults`, …).
- **`src/lib/cartSession.ts`** – `sessionStorage` + UUID relace košíku (`X-Cart-Session`).
- **`e2e/`** – Playwright: `tests/*.spec.ts`, `pages/` (page objects). Popis: [`frontend/e2e/README.md`](frontend/e2e/README.md).

---

## Požadavky

- **Node.js** (verze dle vašeho prostředí; projekt používá aktuální npm skripty).
- **MySQL** — buď lokální instance, nebo kontejner přes Docker Compose (viz níže).
- **Docker Desktop** (nebo jiný Docker engine) — jen pokud chceš DB v kontejneru.
- (Volitelně E2E) **Chromium** pro Playwright: `cd frontend && npx playwright install chromium`.

---

## Docker (MySQL)

V kořeni repozitáře je [`docker-compose.yaml`](docker-compose.yaml): služba **`db`** (image **MySQL 8.4**), kontejner `ai-testing-shop-db`. Aplikace (Node backend / Vite frontend) v compose **není** — ty spouštíš pořád přímo přes `npm run dev`; Docker řeší hlavně databázi bez lokální instalace MySQL.

### Spuštění databáze

Z adresáře, kde leží `docker-compose.yaml` (kořen projektu **`Testing/`**):

```bash
docker compose up -d
```

Ověření, že běží:

```bash
docker compose ps
# nebo
docker logs ai-testing-shop-db --tail 20
```

Výchozí přístup (musí sedět s `DATABASE_URL` v `backend/.env`):

| Položka | Hodnota |
|--------|---------|
| Host z hostitele | `localhost` |
| Port | `3306` |
| Databáze | `ai_testing_shop` |
| Uživatel | `root` |
| Heslo | `password` |

Příklad `backend/.env` při použití tohoto compose:

```env
DATABASE_URL="mysql://root:password@localhost:3306/ai_testing_shop"
```

Pak z `backend/` stejně jako obvykle: `npx prisma migrate deploy` a `npm run prisma:seed`.

### Zastavení

```bash
docker compose stop          # zastavit kontejnery
docker compose down          # zastavit a odstranit kontejnery (data ve volume zůstanou)
docker compose down -v       # navíc smazat volume → prázdná DB při příštím `up`
```

**Kolize portu 3306:** pokud už máš na počítači MySQL, buď ho vypni, nebo v `docker-compose.yaml` změň mapování portů (např. `"3307:3306"`) a v `DATABASE_URL` použij `localhost:3307`.

---

## První spuštění (lokálně)

### 1. Závislosti

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Databáze a seed

V `backend/.env` nastavte např.:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/DB_NAME"
```

Migrace a seed (z adresáře **`backend/`**):

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Seed vytvoří mimo jiné:

- **Admin:** `admin` / `admin` (e‑mail `admin@example.com`)
- **Tester:** `tester` / `tester` (e‑mail `tester@example.com`)
- Tři produkty (např. *Test Mouse*, *Test Keyboard*, *QA Monitor*)
- Záznamy `FaultConfig` (ve výchozím stavu typicky **vypnuté**)

### 3. Běh aplikace

**Dva terminály** (klasický vývoj):

```bash
# Terminál 1 – API na http://localhost:4000
cd backend && npm run dev

# Terminál 2 – UI na http://localhost:5173
cd frontend && npm run dev
```

V prohlížeči otevřete **http://localhost:5173**.

---

## Testy

### Backend – Vitest (`backend/`)

| Typ | Adresář | Popis |
|-----|---------|--------|
| **Unit** | `backend/src/services/unit-tests/` | Služby s mocknutým Prisma; rychlé, bez HTTP a bez nutnosti DB u většiny testů, které mockují DB. |
| **Internal API (integrace)** | `backend/src/integration-tests/` | Supertest proti `createApp()`, **reálná MySQL** podle `.env`; ověřuje kontrakty endpointů jako Postman. |

**Spuštění:**

```bash
cd backend
npm test              # jednorázově všechny testy
npm run test:watch    # interaktivní režim
```

**Jen jeden soubor (příklad):**

```bash
cd backend
npx vitest run src/integration-tests/internalApi.integration.test.ts
```

**Integrační API testy** potřebují připojení k DB a seednutá data (alespoň jeden aktivní produkt).  
**Poznámka:** Pokud máš v aplikaci **zapnuté** faulty zdvojnásobující množství v košíku (API/Unit), asserce v integračních testech košíku můžou selhat — buď faulty v adminu vypni, nebo znovu `npm run prisma:seed` podle toho, jak máš seed nastavený.

### Frontend – Playwright E2E (`frontend/`)

Testy v `frontend/e2e/tests/`; konfigurace v `frontend/playwright.config.ts` (může automaticky spustit backend + Vite přes `npm run dev:e2e`, pokud není `SKIP_WEBSERVER=1`).

```bash
cd frontend
npm run test:e2e           # headless
npm run test:e2e:headed    # viditelný prohlížeč
npm run test:e2e:ui        # Playwright UI
npm run test:e2e:report    # poslední HTML report
```

Podrobnosti: [`frontend/e2e/README.md`](frontend/e2e/README.md).

---

## Důležité koncepty

- **Košík** je vázaný na **relaci** (`X-Cart-Session` + `sessionStorage` ve frontendu), ne na jednoho globálního uživatele v DB — každý tab / kontext Playwright má vlastní košík.
- **Fault injection** — chyby jde zapínat v DB/UI (úrovně UI / API / Unit); slouží k tréninku testů a simulaci regresí.
- **CORS** na backendu povoluje frontend z `http://localhost:5173` a `http://127.0.0.1:5173` a hlavičky včetně `Authorization` a `X-Cart-Session`.

---

## Build (produkční artefakty)

```bash
cd backend && npm run build    # TypeScript → dist/
cd ../frontend && npm run build
```

---

## Nasazení na Azure

Produkční rozložení je **rozdělené na dvě části**: frontend na **Azure Static Web Apps** (SWA) a backend na **Azure Container Apps** + **Azure Database for MySQL – Flexible Server** + **Azure Container Registry** (ACR). Výchozí cesta **nepoužívá App Service** (nevyžaduje kvótu Free/Basic VM pro plán).

Volitelně lze API provozovat na **Azure App Service** (F1/B1) — viz šablonu [`azure/main-appservice.bicep`](azure/main-appservice.bicep) a proměnnou `AZURE_API_HOSTING`.

### Architektura (shrnutí)

| Komponenta | Účel |
|------------|------|
| **Static Web App** | Buildovaný Vite frontend; veřejná HTTPS URL. |
| **Container App** (výchozí) | Docker image z [`backend/Dockerfile`](backend/Dockerfile); při startu kontejneru běží `npx prisma migrate deploy` a pak `node dist/index.js` na portu **4000**. |
| **MySQL Flexible Server** | Databáze `ai_testing_shop`, uživatel `shopadmin` (heslo z nasazení). |
| **ACR** | Registry pro image `shop-api:latest`. |

Proměnná **`VITE_API_BASE_URL`** musí v produkčním buildu frontendu ukazovat na HTTPS URL API (bez koncového lomítka). Lokálně zůstává výchozí `http://localhost:4000`, pokud není nastavena.

**CORS:** V produkci backend používá **`CORS_ORIGINS`** (nastavuje Bicep/deploy z URL Static Web App). Lokálně se k tomu přidají `localhost:5173` a `127.0.0.1:5173`.

### Rychlý start (Azure CLI)

Požadavky: nainstalovaný [**Azure CLI**](https://learn.microsoft.com/cli/azure/install-azure-cli), přihlášení (`az login`), vhodná subscription.

Z kořene repozitáře:

```bash
chmod +x azure/deploy.sh
./azure/deploy.sh <krátký-název>
```

`<krátký-název>` (např. `myshop`) se použije jako základ pro názvy zdrojů. Skript:

1. Vytvoří nebo použije resource group (výchozí `AZURE_RG=rg-ai-testing-shop`).
2. Nasadí Bicep ([`azure/main.bicep`](azure/main.bicep) nebo při `AZURE_API_HOSTING=appservice` soubor [`azure/main-appservice.bicep`](azure/main-appservice.bicep)).
3. U **Container Apps**: zkusí **`az acr build`**; při chybě typu **TasksOperationsNotAllowed** přepne na **lokální Docker** (`linux/amd64` + `docker push`). Image lze předpřipravit a předat **`AZURE_PREBUILT_API_IMAGE`**.
4. Vytvoří nebo aktualizuje Container App / App Service a vypíše **`apiUrl`** a **`staticWebAppUrl`**.

Důležité **proměnné prostředí** (volitelné, viz také [`azure/README.md`](azure/README.md)):

| Proměnná | Význam |
|----------|--------|
| `AZURE_RG` | Název resource group (výchozí `rg-ai-testing-shop`). |
| `AZURE_LOCATION` | Region pro MySQL, ACR, Container Apps (výchozí `westus2`). |
| `AZURE_SWA_LOCATION` | Region Static Web App — musí být z podporovaných (např. `westus2`, `westeurope`). |
| `AZURE_API_HOSTING` | `containerapp` (výchozí) nebo `appservice`. |
| `AZURE_APP_SERVICE_SKU` | Při App Service: `F1` nebo `B1`. |
| `MYSQL_ADMIN_PASSWORD` / `ADMIN_JWT_SECRET` | Volitelně pevné hodnoty (heslo MySQL jen alfanumerické kvůli `DATABASE_URL`). |
| `DEV_CLIENT_IP` | Veřejná IP pro pravidlo firewallu MySQL (vývoj z notebooku). |
| `AZURE_EXISTING_CONTAINER_ENV_ID` | ID existujícího Container Apps Environment (limit 1 env na region v některých subscription). |
| `AZURE_PREBUILT_API_IMAGE` | Plný název image v ACR, pokud build nechcete v skriptu. |

Výstup posledního nasazení je také v `azure/.last-deployment.json` (soubor je v `.gitignore`).

### GitHub Actions

- **Frontend** — workflow [`.github/workflows/azure-static-web-app.yml`](.github/workflows/azure-static-web-app.yml): při pushi na `main` (změny ve `frontend/`) build a nasazení do SWA.  
  - **Repository variable:** `VITE_API_BASE_URL` = hodnota `apiUrl` z výstupu skriptu (např. `https://….azurecontainerapps.io`).  
  - **Secret:** `AZURE_STATIC_WEB_APPS_API_TOKEN` — token ze Static Web App v portálu (*Manage deployment token*).

- **Backend na App Service** — [`.github/workflows/azure-backend.yml`](.github/workflows/azure-backend.yml) se spustí jen když je **`AZURE_USE_APP_SERVICE_DEPLOY=true`** (repository variable). Vyžaduje **`AZURE_WEBAPP_NAME`** a secret **`AZURE_WEBAPP_PUBLISH_PROFILE`**.  
  Při **Container Apps** tento workflow **nepoužívejte** pro API — backend aktualizujte znovu spuštěním `./azure/deploy.sh` (stejný název zdrojů) nebo vlastním CI, které pushne image do ACR a zavolá `az containerapp update`.

### Databáze: migrace a seed

- Migrace se při **Container Apps** spouštějí automaticky při startu kontejneru (viz `CMD` v [`backend/Dockerfile`](backend/Dockerfile)).
- **Seed** (produkty, uživatelé admin/tester, …) se **nespouští automaticky**. Jednorázově z počítače s povolenou IP v firewallu MySQL:

```bash
export DATABASE_URL='mysql://shopadmin:<HESLO>@<HOST>.mysql.database.azure.com:3306/ai_testing_shop?sslaccept=strict'
cd backend && npx prisma migrate deploy && npm run prisma:seed
```

Formát `DATABASE_URL` pro Azure MySQL musí obsahovat **`?sslaccept=strict`** (ne syntaxi jako u CLI klienta `mysql`).

### Ověření po nasazení

- `GET {apiUrl}/health` → JSON s `"status":"ok"`.
- Otevřít URL Static Web App; v síťové záložce prohlížeče ověřit volání API na `VITE_API_BASE_URL`.

### Podrobnosti a řešení problémů

Kompletní návod (regiony, kvóty, ACR build vs. Docker, limit prostředí Container Apps, CORS) je v **[`azure/README.md`](azure/README.md)**.

---

## Další dokumentace v repu

- [`azure/README.md`](azure/README.md) – Azure: Bicep, `deploy.sh`, GitHub Actions, DB, troubleshooting  
- [`frontend/e2e/README.md`](frontend/e2e/README.md) – E2E příkazy, CORS, struktura testů  
- [`backend/MockConfigs/README.md`](backend/MockConfigs/README.md) – mock platby podle e‑mailu kupujícího  
- Playwright UI automatizace (Cursor skill): [`.cursor/skills/playwright-ui-automation/SKILL.md`](.cursor/skills/playwright-ui-automation/SKILL.md)  

---

## Licence / autorské práva

Dle nastavení v `package.json` jednotlivých balíčků (backend `ISC`).
