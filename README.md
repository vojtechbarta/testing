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

## Další dokumentace v repu

- [`frontend/e2e/README.md`](frontend/e2e/README.md) – E2E příkazy, CORS, struktura testů  
- [`backend/MockConfigs/README.md`](backend/MockConfigs/README.md) – mock platby podle e‑mailu kupujícího  
- Playwright UI automatizace (Cursor skill): [`.cursor/skills/playwright-ui-automation/SKILL.md`](.cursor/skills/playwright-ui-automation/SKILL.md)  

---

## Licence / autorské práva

Dle nastavení v `package.json` jednotlivých balíčků (backend `ISC`).
