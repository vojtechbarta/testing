import request from "supertest";
import { describe, expect, it } from "vitest";
import { loginAsAdmin, loginAsTester } from "./helpers/auth";
import { app, setupInternalApiSuite } from "./helpers/internalApiTestHarness";

describe("Internal API - products", () => {
  setupInternalApiSuite({ cleanupProducts: true });

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
    const fullCount = (full.body as { products: unknown[] }).products.length;
    const spacedCount = (spaced.body as { products: unknown[] }).products.length;
    // Other suites may create active fixture products concurrently; whitespace query should still be near unfiltered.
    expect(Math.abs(spacedCount - fullCount)).toBeLessThanOrEqual(1);
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

  it("GET /products default lang en returns EUR storage prices", async () => {
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
    expect(mouse!.price.amount).toBe(17);
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
      expect(products[i]!.price.amount).toBeGreaterThanOrEqual(products[i + 1]!.price.amount);
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
    const token = await loginAsAdmin();
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

  it("POST /admin/products with tester token is 403", async () => {
    const token = await loginAsTester();
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

  it("POST /admin/products creates product when admin (add product in admin)", async () => {
    const token = await loginAsAdmin();
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

  it("PUT /admin/products/:id updates product when admin", async () => {
    const token = await loginAsAdmin();
    const uniqueName = `Integration API Product update ${Date.now()}`;
    const createRes = await request(app)
      .post("/admin/products")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: uniqueName,
        description: "to be updated",
        price: { amount: 10, currencyCode: "CZK" },
        inStock: 2,
        active: true,
      })
      .expect(201);

    const id = (createRes.body as { id: number }).id;
    const updateRes = await request(app)
      .put(`/admin/products/${id}`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `${uniqueName} v2`,
        description: "updated description",
        price: { amount: 25, currencyCode: "CZK" },
        inStock: 5,
        active: false,
      })
      .expect(200);

    expect(updateRes.body).toMatchObject({
      id,
      name: `${uniqueName} v2`,
      inStock: 5,
      active: false,
      price: { amount: 25, currencyCode: "CZK" },
    });
  });

  it("DELETE /admin/products/:id removes product when admin", async () => {
    const token = await loginAsAdmin();
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
    await request(app).delete(`/admin/products/${id}`).set("Authorization", `Bearer ${token}`).expect(204);
    await request(app).delete(`/admin/products/${id}`).set("Authorization", `Bearer ${token}`).expect(404);
  });
});
