# Fault Injection Catalog

All faults are managed in the **Admin → Fault injection** panel (login as `admin@example.com`).  
They are stored in the `FaultConfig` table and seeded via `npm run prisma:seed`.

Each fault is **disabled by default**. Enabling/disabling takes effect within ~1 second (runtime cache TTL).

---

## Levels

| Level | Where the bug lives |
|-------|---------------------|
| **UI** | Frontend React code — the backend behaves correctly |
| **API** | Backend route/controller layer |
| **Unit** | Backend service / database layer |

---

## Fault reference

### `cart_add_ui_double_call`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Double-add to cart |
| **Description** | With a single click the UI calls the cart-add endpoint **twice**. Each call adds 1 unit, so the cart ends up with 2 items instead of 1. |
| **Supports `failureRate`** | Yes — e.g. `0.5` triggers the double call on ~50 % of clicks |
| **Affected area** | "Add to cart" button on the product card and product detail |

---

### `cart_add_api_double_quantity_payload`
| | |
|---|---|
| **Level** | API |
| **Name** | API: Doubled cart quantity delta |
| **Description** | The API route doubles the requested quantity delta before passing it to the service layer. A request to add 1 item persists as 2. |
| **Supports `failureRate`** | No (always triggers when enabled) |
| **Affected area** | `POST /cart/items` endpoint |

---

### `cart_add_unit_double_quantity_persist`
| | |
|---|---|
| **Level** | Unit |
| **Name** | Backend/DB: Doubled cart quantity delta |
| **Description** | The service layer doubles the quantity delta before writing to the database. The HTTP response already contains the inflated value. |
| **Supports `failureRate`** | No (always triggers when enabled) |
| **Affected area** | `cartService` — database write |

---

### `sort_price_asc_swap_last_two`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Price sort – swap last two items |
| **Description** | When the product list is sorted by **Price (low to high)** the last two products silently swap their positions. All other sort orders are unaffected. |
| **Supports `failureRate`** | No |
| **Affected area** | Product grid — "Price (low to high)" sort option |

---

### `sort_name_desc_swap_last_two`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Name Z-A sort – swap last two items |
| **Description** | When the product list is sorted by **Name (Z-A)** the last two products silently swap their positions. All other sort orders are unaffected. |
| **Supports `failureRate`** | No |
| **Affected area** | Product grid — "Name (Z-A)" sort option |

---

### `ui_label_typos`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Label typos |
| **Description** | Introduces three simultaneous typos across the UI (same places in every language): |
| | • Sort dropdown — name A→Z option: EN **"Name (A-Z)"** → **"Name (A-Y)"**; CS **"Název (A–Z)"** → **"Název (A–Y)"** |
| | • Product card stock badge: EN **"In Stock"** → **"In Sock"**; CS **"Skladem"** → **"Skadem"** (dropped **l**, analogous typo) |
| | • Checkout address fieldset legend: EN **"Address (optional)"** → **"Adres (optional)"**; CS **"Adresa (nepovinné)"** → **"Adres (nepovinné)"** |
| **Supports `failureRate`** | No |
| **Affected area** | Product grid sort control, product card, checkout form |

**i18n:** Typo strings come from locale keys (`shop.sortNameAscTypo`, `shop.inSockTypo`, `checkout.addressLegendTypo`) in both **English** and **Czech** so the fault behaves the same when the language switcher is EN or CS.

---

### `grid_non_chrome_broken`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Broken product grid (non-Chrome) |
| **Description** | Simulates a CSS grid cross-browser compatibility bug. In **any browser other than Google Chrome** (detected via `navigator.vendor`) the product grid renders with misaligned and partially overlapping cards. Chrome (Mac & Windows) is unaffected. |
| **Supports `failureRate`** | No |
| **Affected area** | Product grid — visible only in Firefox, Safari, Edge (non-Chromium), etc. |

---

## How to add a new fault

1. **Seed** — add a `prisma.faultConfig.upsert` block in `backend/prisma/seed.ts`.
2. **Runtime key** — add the key string to `FAULT_KEYS` in `backend/src/faults/faultRuntime.ts`.
3. **Behaviour** — implement the effect:
   - **UI fault**: read `activeUiFaultConfigs` in `frontend/src/App.tsx` and branch on `f.key`.
   - **API fault**: call `shouldTriggerFault(FAULT_KEYS.xxx)` in the relevant route in `backend/src/routes/`.
   - **Unit fault**: call `shouldTriggerFault(FAULT_KEYS.xxx)` in the relevant service in `backend/src/services/`.
4. **Run seed locally**: `cd backend && npm run prisma:seed`
5. **Document** — add an entry to this file.
