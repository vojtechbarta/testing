/**
 * Integration tests: real HTTP against the Express app (Supertest), real DB (Prisma).
 * Same idea as Postman/Swagger: call endpoint + assert status and body.
 *
 * Requires: MySQL per DATABASE_URL in .env, migrations applied, seed run (at least one active product).
 * Run from backend: `npm test` (no server process needed on port 4000).
 * Location: `src/integration-tests/` (internal HTTP API contract tests).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import prisma from "../db/prisma";

const app = createApp();

/** Stable cart session keys for tests; rows are deleted in afterAll. */
const CART_SESSION = "aaaaaaaa-bbbb-4ccc-bddd-000000000001";
const CART_SESSION_SINGLE_ITEM = "aaaaaaaa-bbbb-4ccc-bddd-000000000002";
const CART_SESSION_LANG_CS = "aaaaaaaa-bbbb-4ccc-bddd-000000000003";
const CART_SESSION_CHECKOUT_CS = "aaaaaaaa-bbbb-4ccc-bddd-000000000004";

describe("Internal API (frontend contract)", () => {
  let seededProductId: number;

  // Load one active product id from the seeded DB so cart/product tests use a real productId.
  beforeAll(async () => {
    await prisma.$connect();
    const first = await prisma.product.findFirst({
      where: { active: true },
      orderBy: { id: "asc" },
    });
    if (!first) {
      throw new Error(
        "No active product in DB — run `npx prisma migrate deploy` and `npm run prisma:seed`",
      );
    }
    seededProductId = first.id;
  });

  // Remove cart lines and integration-test products so runs stay repeatable.
  afterAll(async () => {
    await prisma.cartItem.deleteMany({
      where: {
        cartKey: {
          in: [
            CART_SESSION,
            CART_SESSION_SINGLE_ITEM,
            CART_SESSION_LANG_CS,
            CART_SESSION_CHECKOUT_CS,
          ],
        },
      },
    });
    await prisma.product.deleteMany({
      where: { name: { startsWith: "Integration API Product" } },
    });
    await prisma.$disconnect();
  });

  // Smoke check: liveness endpoint used by deploy/scripts.
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  // Public catalog: storefront envelope (products + global price bounds for the current lang/currency).
  it("GET /products returns storefront envelope with product DTOs", async () => {
    const res = await request(app).get("/products").expect(200);
    expect(res.body).toMatchObject({
      products: expect.any(Array),
      priceBounds: {
        min: expect.any(Number),
        max: expect.any(Number),
        currencyCode: expect.any(String),
      },
    });
    const { products } = res.body as {
      products: Array<{
        id: number;
        name: string;
        price: { amount: number; currencyCode: string };
      }>;
    };
    expect(products.length).toBeGreaterThan(0);
    const p = products[0]!;
    expect(typeof p.id).toBe("number");
    expect(typeof p.name).toBe("string");
    expect(p.price).toMatchObject({
      amount: expect.any(Number),
      currencyCode: expect.any(String),
    });
  });

  it("GET /exchange-rates returns seeded EUR→CZK rate (1 EUR = 24 CZK)", async () => {
    const res = await request(app).get("/exchange-rates").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const rows = res.body as {
      fromCurrencyCode: string;
      toCurrencyCode: string;
      exchangeRate: number;
    }[];
    const eurCzk = rows.find(
      (r) => r.fromCurrencyCode === "EUR" && r.toCurrencyCode === "CZK",
    );
    expect(eurCzk?.exchangeRate).toBe(24);
  });

  // Shop search: query param `q` filters active products by name/description (e.g. seed "Wireless Mouse M200").
  it("GET /products?q=… filters catalog (search on main shop)", async () => {
    const res = await request(app).get("/products").query({ q: "Mouse" }).expect(200);
    const { products } = res.body as { products: { name: string }[] };
    expect(Array.isArray(products)).toBe(true);
    const names = products.map((p) => p.name);
    expect(names.some((n) => n.toLowerCase().includes("mouse"))).toBe(true);
  });

  it("GET /products returns seeded storefront size (15 active products after full seed)", async () => {
    const res = await request(app).get("/products").expect(200);
    const { products } = res.body as { products: unknown[] };
    expect(products.length).toBeGreaterThanOrEqual(15);
  });

  it("GET /products?q= matches description text, not only product name", async () => {
    const res = await request(app).get("/products").query({ q: "ergonomic" }).expect(200);
    const { products: rows } = res.body as {
      products: { name: string; description: string }[];
    };
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.some(
        (p) =>
          p.description.toLowerCase().includes("ergonomic") ||
          p.name.toLowerCase().includes("ergonomic"),
      ),
    ).toBe(true);
  });

  it("GET /products?q= returns empty products when no row matches", async () => {
    const res = await request(app)
      .get("/products")
      .query({ q: "zzzz-no-such-product-999" })
      .expect(200);
    expect(res.body).toMatchObject({ products: [], priceBounds: expect.any(Object) });
  });

  it("GET /products?q= with only whitespace behaves like no search filter", async () => {
    const full = await request(app).get("/products").expect(200);
    const spaced = await request(app).get("/products").query({ q: "  \t  " }).expect(200);
    expect((spaced.body as { products: unknown[] }).products.length).toBe(
      (full.body as { products: unknown[] }).products.length,
    );
  });

  it("GET /products?q= trims leading and trailing spaces in the query", async () => {
    const res = await request(app).get("/products").query({ q: "  Mouse  " }).expect(200);
    const { products } = res.body as { products: { name: string }[] };
    const names = products.map((p) => p.name);
    expect(names.some((n) => n.toLowerCase().includes("mouse"))).toBe(true);
  });

  it("GET /products?q= can return multiple products (name OR description contains term)", async () => {
    const res = await request(app).get("/products").query({ q: "USB" }).expect(200);
    const { products: rows } = res.body as {
      products: { name: string; description: string }[];
    };
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const p of rows) {
      const blob = `${p.name} ${p.description}`.toLowerCase();
      expect(blob.includes("usb"), `expected "USB" in name or description: ${p.name}`).toBe(
        true,
      );
    }
  });

  it("GET /products?lang=cs returns Czech product title for seeded id 1", async () => {
    const res = await request(app).get("/products").query({ lang: "cs" }).expect(200);
    const { products } = res.body as { products: { id: number; name: string }[] };
    const p1 = products.find((p) => p.id === 1);
    expect(p1?.name).toBe("Bezdrátová myš M200");
  });

  it("GET /faults/inject-error returns 400 with Czech message when lang=cs", async () => {
    const res = await request(app)
      .get("/faults/inject-error")
      .query({ lang: "cs" })
      .expect(400);
    expect(res.body).toEqual({ message: "tohle je bug" });
  });

  it("GET /faults/inject-error returns 400 with English message by default", async () => {
    const res = await request(app).get("/faults/inject-error").expect(400);
    expect(res.body).toEqual({ message: "this is bug" });
  });

  it("GET /faults/ui returns enabled ui faults envelope", async () => {
    const res = await request(app).get("/faults/ui").expect(200);
    expect(res.body).toMatchObject({
      faults: expect.any(Array),
    });
  });

  it("GET /faults/ui ignores unknown query params and still returns 200", async () => {
    const res = await request(app).get("/faults/ui").query({ unexpected: "1" }).expect(200);
    expect(Array.isArray((res.body as { faults: unknown[] }).faults)).toBe(true);
  });

  it("GET /products default lang en returns EUR display prices when seed EUR→CZK rate exists", async () => {
    const res = await request(app).get("/products").expect(200);
    const { products } = res.body as {
      products: { id: number; name: string; price: { amount: number; currencyCode: string } }[];
    };
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.price.currencyCode).toBe("EUR");
    }
    const mouse = products.find((p) => p.id === 1);
    expect(mouse).toBeDefined();
    expect(mouse!.price.amount).toBe(16.63);
  });

  it("GET /products?sort=name-asc returns names sorted ascending (English locale)", async () => {
    const res = await request(app).get("/products").query({ sort: "name-asc" }).expect(200);
    const { products } = res.body as { products: { name: string }[] };
    const names = products.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en"));
    expect(names).toEqual(sorted);
  });

  it("GET /products?sort=price-desc returns strictly descending display prices", async () => {
    const res = await request(app).get("/products").query({ sort: "price-desc" }).expect(200);
    const { products, priceBounds } = res.body as {
      products: { price: { amount: number } }[];
      priceBounds: { min: number; max: number };
    };
    expect(products.length).toBeGreaterThan(1);
    expect(products[0]!.price.amount).toBe(priceBounds.max);
    for (let i = 0; i < products.length - 1; i += 1) {
      expect(products[i]!.price.amount).toBeGreaterThanOrEqual(
        products[i + 1]!.price.amount,
      );
    }
  });

  it("GET /products?lang=cs&priceMin&priceMax filters products but priceBounds stay global (pre-filter)", async () => {
    const full = await request(app).get("/products").query({ lang: "cs" }).expect(200);
    const fullBody = full.body as {
      products: { price: { amount: number } }[];
      priceBounds: { min: number; max: number; currencyCode: string };
    };
    expect(fullBody.priceBounds.currencyCode).toBe("CZK");
    const filtered = await request(app)
      .get("/products")
      .query({ lang: "cs", priceMin: 400, priceMax: 900 })
      .expect(200);
    const filteredBody = filtered.body as typeof fullBody;
    expect(filteredBody.priceBounds).toEqual(fullBody.priceBounds);
    expect(filteredBody.products.length).toBeGreaterThan(0);
    expect(filteredBody.products.length).toBeLessThan(fullBody.products.length);
    for (const p of filteredBody.products) {
      expect(p.price.amount).toBeGreaterThanOrEqual(400);
      expect(p.price.amount).toBeLessThanOrEqual(900);
    }
  });

  it("GET /cart?lang=cs and POST /cart/items?lang=cs return Czech names and CZK money", async () => {
    const postRes = await request(app)
      .post("/cart/items")
      .query({ lang: "cs" })
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_LANG_CS)
      .send({ productId: 1, quantity: 1 })
      .expect(200);

    const postBody = postRes.body as {
      items: { productId: number; name: string; price: { currencyCode: string; amount: number } }[];
      total: { currencyCode: string; amount: number };
    };
    expect(postBody.items).toHaveLength(1);
    expect(postBody.items[0]?.name).toBe("Bezdrátová myš M200");
    expect(postBody.items[0]?.price.currencyCode).toBe("CZK");
    expect(postBody.items[0]?.price.amount).toBe(399);
    expect(postBody.total.currencyCode).toBe("CZK");
    expect(postBody.total.amount).toBe(399);

    const getRes = await request(app)
      .get("/cart")
      .query({ lang: "cs" })
      .set("X-Cart-Session", CART_SESSION_LANG_CS)
      .expect(200);

    expect(getRes.body).toEqual(postRes.body);
  });

  it("POST /checkout/bank-transfer?lang=cs returns Czech message and Czech dummy bank note", async () => {
    await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_CHECKOUT_CS)
      .query({ lang: "cs" })
      .send({ productId: 1, quantity: 1 })
      .expect(200);

    const res = await request(app)
      .post("/checkout/bank-transfer")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_CHECKOUT_CS)
      .query({ lang: "cs" })
      .send({
        customerEmail: "checkout-cs@example.test",
        customerFirstName: "Jan",
        customerLastName: "Novak",
        customerPhone: "+420123456789",
      })
      .expect(201);

    const body = res.body as {
      message: string;
      bankTransfer: { note: string };
    };
    expect(body.message).toMatch(
      /Zpráva byla odeslána do Ethereal|Potvrzovací e-mail k objednávce byl odeslán|Objednávka byla vytvořena/,
    );
    expect(body.bankTransfer.note).toContain("DUMMY PLATEBNÍ ÚDAJE");
  });

  // Cart API requires a valid UUID in X-Cart-Session; missing header must fail fast with 400.
  it("POST /cart/items rejects missing X-Cart-Session", async () => {
    const res = await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .send({ productId: seededProductId, quantity: 1 })
      .expect(400);
    expect(res.body.message).toMatch(/X-Cart-Session/i);
  });

  // Set line quantity to 2 for one product; response must be the full cart DTO (session, items, total).
  // Expects fault injection for double-quantity to be OFF, otherwise quantity may be doubled.
  it("POST /cart/items adds line and returns cart DTO", async () => {
    const res = await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION)
      .send({ productId: seededProductId, quantity: 2 })
      .expect(200);

    expect(res.body).toMatchObject({
      cartSessionId: CART_SESSION,
      items: expect.any(Array),
      total: { amount: expect.any(Number), currencyCode: expect.any(String) },
    });
    const line = (res.body.items as { productId: number; quantity: number }[]).find(
      (i) => i.productId === seededProductId,
    );
    expect(line?.quantity).toBe(2);
  });

  // Add exactly one unit: POST returns the full cart (same shape as GET /cart); GET verifies read-after-write.
  // If `cart_add_api_double_quantity_payload` (or similar) is enabled in DB, quantity expectations change.
  it("POST /cart/items adds exactly one unit of a product (assert in response + GET /cart)", async () => {
    const postRes = await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_SINGLE_ITEM)
      .send({ productId: seededProductId, quantity: 1 })
      .expect(200);

    type CartLine = { productId: number; quantity: number; name: string };
    const items = postRes.body.items as CartLine[];
    const linesForProduct = items.filter((i) => i.productId === seededProductId);
    expect(linesForProduct).toHaveLength(1);
    expect(linesForProduct[0]?.quantity).toBe(1);

    const getRes = await request(app)
      .get("/cart")
      .set("X-Cart-Session", CART_SESSION_SINGLE_ITEM)
      .expect(200);

    expect(getRes.body).toEqual(postRes.body);
  });

  // Auth: wrong password for a valid username must return 401, not 200.
  it("POST /auth/login rejects bad credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "wrong" })
      .expect(401);
    expect(res.body.message).toBeDefined();
  });

  // Admin product routes require Bearer token; anonymous create must be 401 Unauthorized.
  it("POST /admin/products without token is 401", async () => {
    await request(app)
      .post("/admin/products")
      .set("Content-Type", "application/json")
      .send({
        name: "x",
        description: "y",
        price: { amount: 100, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      })
      .expect(401);
  });

  it("GET /admin/products without token is 401", async () => {
    await request(app).get("/admin/products").expect(401);
  });

  it("GET /admin/products returns list for admin token", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "admin" })
      .expect(200);
    const token = (login.body as { token: string }).token;

    const res = await request(app)
      .get("/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
      });
    }
  });

  it("GET /admin/faults without token is 401", async () => {
    await request(app).get("/admin/faults").expect(401);
  });

  it("GET /admin/faults returns fault list for tester token", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ username: "tester", password: "tester" })
      .expect(200);
    const token = (login.body as { token: string }).token;

    const res = await request(app)
      .get("/admin/faults")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it("PATCH /admin/faults/:key without token is 401", async () => {
    await request(app)
      .patch("/admin/faults/cart_add_ui_double_call")
      .set("Content-Type", "application/json")
      .send({ enabled: false })
      .expect(401);
  });

  it("PATCH /admin/faults/:key returns updated fault for tester token", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ username: "tester", password: "tester" })
      .expect(200);
    const token = (login.body as { token: string }).token;

    const res = await request(app)
      .patch("/admin/faults/cart_add_ui_double_call")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ enabled: false })
      .expect(200);

    expect(res.body).toMatchObject({
      key: "cart_add_ui_double_call",
      enabled: false,
    });
  });

  it("PATCH /admin/faults/:key with invalid token is 401", async () => {
    await request(app)
      .patch("/admin/faults/cart_add_ui_double_call")
      .set("Authorization", "Bearer invalid-token")
      .set("Content-Type", "application/json")
      .send({ enabled: false })
      .expect(401);
  });

  it("GET /docs-json returns OpenAPI document", async () => {
    const res = await request(app).get("/docs-json").expect(200);
    expect(res.body).toMatchObject({
      openapi: expect.any(String),
      info: expect.any(Object),
      paths: expect.any(Object),
    });
  });

  // Role guard: TESTER can manage faults but must not create products — 403 Forbidden.
  it("POST /admin/products with tester token is 403", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ username: "tester", password: "tester" })
      .expect(200);

    const token = (login.body as { token: string }).token;

    await request(app)
      .post("/admin/products")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "x",
        description: "y",
        price: { amount: 100, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      })
      .expect(403);
  });

  // Happy path for admin: login as ADMIN, POST new product, assert 201 body (name, stock, price, id).
  // Product name is unique and removed in afterAll by prefix.
  it("POST /admin/products creates product when admin (add product in admin)", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "admin" })
      .expect(200);

    const token = (login.body as { token: string }).token;
    const uniqueName = `Integration API Product ${Date.now()}`;

    const res = await request(app)
      .post("/admin/products")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: uniqueName,
        description: "Created by internal API integration test",
        price: { amount: 42, currencyCode: "CZK" },
        inStock: 3,
        active: true,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      name: uniqueName,
      inStock: 3,
      price: { amount: 42, currencyCode: "CZK" },
    });
    expect(typeof (res.body as { id: number }).id).toBe("number");
  });

  it("DELETE /admin/products/:id removes product when admin", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "admin" })
      .expect(200);

    const token = (login.body as { token: string }).token;
    const uniqueName = `Integration API Product delete ${Date.now()}`;

    const createRes = await request(app)
      .post("/admin/products")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: uniqueName,
        description: "deleted by integration test",
        price: { amount: 1, currencyCode: "CZK" },
        inStock: 0,
        active: false,
      })
      .expect(201);

    const id = (createRes.body as { id: number }).id;

    await request(app)
      .delete(`/admin/products/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await request(app)
      .delete(`/admin/products/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });
});
