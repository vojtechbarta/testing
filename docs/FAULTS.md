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

### `cart_add_api_double_quantity_payload`
| | |
|---|---|
| **Level** | API |
| **Name** | API: Doubled cart quantity delta |
| **Description** | The API route doubles the requested quantity delta before passing it to the service layer. A request to add 1 item persists as 2. |
| **Supports `failureRate`** | No (always triggers when enabled) |
| **Affected area** | `POST /cart/items` endpoint |

---

### `cart_add_ui_double_call`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Double-add to cart |
| **Description** | With a single click the UI calls the cart-add endpoint **twice**. Each call adds 1 unit, so the cart ends up with 2 items instead of 1. |
| **Supports `failureRate`** | Yes — e.g. `0.5` triggers the double call on ~50 % of clicks |
| **Affected area** | "Add to cart" button on the product card and product detail |

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

### `checkout_email_wrong_language`
| | |
|---|---|
| **Level** | API |
| **Name** | API: Checkout email in wrong language |
| **Description** | The bank-transfer checkout route sends confirmation email content in the opposite language than the selected storefront language (**EN↔CS**). |
| **Supports `failureRate`** | Yes — when set, the language flip triggers probabilistically |
| **Affected area** | `POST /checkout/bank-transfer` → confirmation email subject/body |

---

### `console_error_every_minute`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Console error every minute |
| **Description** | When enabled, frontend logs a console error every 60 seconds so testers must inspect DevTools Console. Message is localized: CS **"toto je error"**, EN **"this is error"**. |
| **Supports `failureRate`** | No |
| **Affected area** | Browser DevTools → Console |

---

### `discount_more_is_less_boundary_4`
| | |
|---|---|
| **Level** | API |
| **Name** | API: MoreIsLess discount — boundary off-by-one at 4 items |
| **Description** | Volume code **MoreIsLess**: exactly **4** units in cart still yields **15%** instead of **20%**; **5+** yields **20%**. |
| **Supports `failureRate`** | No |
| **Affected area** | Cart totals and checkout pricing when promo **MOREISLESS** is applied (`resolveMoreIsLessFinalPercent`) |

---

### `discount_more_is_less_empty_at_10`
| | |
|---|---|
| **Level** | API |
| **Name** | API: MoreIsLess discount — toxic partition at 10 items |
| **Description** | Volume code **MoreIsLess**: exactly **10** units yields **0%** discount; other counts follow normal tiers. |
| **Supports `failureRate`** | No |
| **Affected area** | Cart totals and checkout pricing when promo **MOREISLESS** is applied |

---

### `discount_more_is_less_tier_20_plus_50pct`
| | |
|---|---|
| **Level** | API |
| **Name** | API: MoreIsLess discount — bogus 50% tier at 20+ items |
| **Description** | Volume code **MoreIsLess**: **20** or more units yields **50%** off (incorrect extra tier vs baseline spec). |
| **Supports `failureRate`** | No |
| **Affected area** | Cart totals and checkout pricing when promo **MOREISLESS** is applied |

---

### `export_cart_ui_swap_currency_label`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Export cart swaps EUR/CZK labels |
| **Description** | Cart export (both CSV and PDF) swaps currency labels **EUR↔CZK** while keeping numeric amounts unchanged. The bug affects unit price, line total, and exported estimated total label. |
| **Supports `failureRate`** | No |
| **Affected area** | Shop export panel — cart CSV + PDF |

---

### `export_products_ui_ignore_sort_name_asc`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Export products ignores active sorting |
| **Description** | Product export (both CSV and PDF) ignores current catalog sorting and always exports products in **Name (A-Z)** order. |
| **Supports `failureRate`** | No |
| **Affected area** | Shop export panel — products CSV + PDF |

---

### `export_products_ui_omit_middle_item`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI: Export products omits one middle item |
| **Description** | Product export (both CSV and PDF) silently omits exactly one product from the **middle** of the exported list. The last item is still present. |
| **Supports `failureRate`** | No |
| **Affected area** | Shop export panel — products CSV + PDF |

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

### `network_inject_api_fail_every minute`
| | |
|---|---|
| **Level** | UI |
| **Name** | UI/API: Inject error network call every minute |
| **Description** | When enabled, frontend calls `GET /faults/inject-error` every 60 seconds (with current `lang`). Endpoint always returns **400 Bad Request** with localized response message: CS **"tohle je bug"**, EN **"this is bug"**. |
| **Supports `failureRate`** | No |
| **Affected area** | Browser DevTools → Network |

---

### `products_api_odd_minute_wait_to_even`
| | |
|---|---|
| **Level** | API |
| **Name** | API: Products odd-minute delay to next even minute |
| **Description** | Controlled performance fault injection on `GET /products`. When enabled and the current minute at request time is **odd**, the API delays the response until the start of the **next even minute**, simulating intermittent latency up to almost 60 seconds. When the minute is even, the endpoint behaves normally. |
| **Supports `failureRate`** | No (time-based behavior only) |
| **Affected area** | `GET /products` — main storefront product catalog on the homepage |

---

### `sort_name_desc_swap_last_two`
| | |
|---|---|
| **Level** | API |
| **Name** | API: Name Z-A sort – swap last two items |
| **Description** | When the product list is sorted by **Name (Z-A)** the last two products silently swap their positions. All other sort orders are unaffected. |
| **Supports `failureRate`** | No |
| **Affected area** | `GET /products` sort pipeline (`sort=name-desc`) |

---

### `sort_price_asc_swap_last_two`
| | |
|---|---|
| **Level** | API |
| **Name** | API: Price sort – swap last two items |
| **Description** | When the product list is sorted by **Price (low to high)** the last two products silently swap their positions. All other sort orders are unaffected. |
| **Supports `failureRate`** | No |
| **Affected area** | `GET /products` sort pipeline (`sort=price-asc`) |

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

## How to add a new fault

1. **Seed** — add a `prisma.faultConfig.upsert` block in `backend/prisma/seed.ts`.
2. **Runtime key** — add the key string to `FAULT_KEYS` in `backend/src/faults/faultRuntime.ts`.
3. **Behaviour** — implement the effect:
   - **UI fault**: read `activeUiFaultConfigs` in `frontend/src/App.tsx` and branch on `f.key`.
   - **API fault**: call `shouldTriggerFault(FAULT_KEYS.xxx)` in the relevant route in `backend/src/routes/`.
   - **Unit fault**: call `shouldTriggerFault(FAULT_KEYS.xxx)` in the relevant service in `backend/src/services/`.
4. **Run seed locally**: `cd backend && npm run prisma:seed`
5. **Document** — add an entry to this file (keep keys in **alphabetical order**).
