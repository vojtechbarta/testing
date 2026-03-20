/**
 * Integration tests: real HTTP against the Express app (Supertest), real DB (Prisma).
 * Ekvivalent Postmane/Swaggeru: request + assert na status a tělo odpovědi.
 *
 * Vyžaduje: MySQL dle DATABASE_URL v .env, provedené migrace a seed (alespoň 3 produkty).
 *
 * Spuštění: `npm test` z adresáře backend (bez běžícího serveru na portu).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import prisma from "../db/prisma";

const app = createApp();

/** Fixed sessions for cart tests; cleaned up in afterAll. */
const CART_SESSION = "aaaaaaaa-bbbb-4ccc-bddd-000000000001";
const CART_SESSION_SINGLE_ITEM = "aaaaaaaa-bbbb-4ccc-bddd-000000000002";

describe("Internal API (frontend contract)", () => {
  let seededProductId: number;

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

  afterAll(async () => {
    await prisma.cartItem.deleteMany({
      where: {
        cartKey: { in: [CART_SESSION, CART_SESSION_SINGLE_ITEM] },
      },
    });
    await prisma.product.deleteMany({
      where: { name: { startsWith: "Integration API Product" } },
    });
    await prisma.$disconnect();
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /products returns list of storefront DTOs", async () => {
    const res = await request(app).get("/products").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const p = res.body[0] as {
      id: number;
      name: string;
      price: { amount: number; currencyCode: string };
      active?: boolean;
    };
    expect(typeof p.id).toBe("number");
    expect(typeof p.name).toBe("string");
    expect(p.price).toMatchObject({
      amount: expect.any(Number),
      currencyCode: expect.any(String),
    });
  });

  it("GET /products?q=… filters catalog (search on main shop)", async () => {
    const res = await request(app).get("/products").query({ q: "Mouse" }).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const names = (res.body as { name: string }[]).map((p) => p.name);
    expect(names.some((n) => n.toLowerCase().includes("mouse"))).toBe(true);
  });

  it("POST /cart/items rejects missing X-Cart-Session", async () => {
    const res = await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .send({ productId: seededProductId, quantity: 1 })
      .expect(400);
    expect(res.body.message).toMatch(/X-Cart-Session/i);
  });

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

  /**
   * Přidání 1 ks při vypnutých faultech: očekávaný kontrakt API.
   * POST vrací celý košík (jako GET /cart); GET navíc ověří shodu stavu.
   *
   * Zapnutý fault `cart_add_api_double_quantity_payload` v DB/UI by stejný request změnil
   * očekávané chování (simulace chybné úpravy API/backendu).
   */
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

  it("POST /auth/login rejects bad credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "wrong" })
      .expect(401);
    expect(res.body.message).toBeDefined();
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
});
