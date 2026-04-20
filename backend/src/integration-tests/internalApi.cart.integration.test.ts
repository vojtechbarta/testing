import request from "supertest";
import { describe, expect, it } from "vitest";
import prisma from "../db/prisma";
import {
  CART_SESSION,
  CART_SESSION_LANG_CS,
  CART_SESSION_PROMO,
  CART_SESSION_SINGLE_ITEM,
} from "./helpers/cartSessions";
import {
  app,
  getSuiteProductId,
  setupInternalApiSuite,
} from "./helpers/internalApiTestHarness";

describe("Internal API - cart", () => {
  setupInternalApiSuite({
    suiteId: "cart",
    cartKeys: [CART_SESSION, CART_SESSION_LANG_CS, CART_SESSION_PROMO, CART_SESSION_SINGLE_ITEM],
    dedicatedProduct: true,
  });

  it("GET /cart?lang=cs and POST /cart/items?lang=cs keep the same localized cart payload", async () => {
    const postRes = await request(app)
      .post("/cart/items")
      .query({ lang: "cs" })
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_LANG_CS)
      .send({ productId: getSuiteProductId("cart"), quantity: 1 })
      .expect(200);

    const postBody = postRes.body as {
      items: { productId: number; name: string; price: { currencyCode: string; amount: number } }[];
      total: { currencyCode: string; amount: number };
    };
    expect(postBody.items).toHaveLength(1);
    expect(postBody.items[0]?.name).toEqual(expect.any(String));
    expect(postBody.items[0]?.price.currencyCode).toEqual(expect.any(String));
    expect(postBody.items[0]?.price.amount).toBeGreaterThan(0);
    expect(postBody.total.currencyCode).toEqual(expect.any(String));
    expect(postBody.total.amount).toBeGreaterThan(0);

    const getRes = await request(app)
      .get("/cart")
      .query({ lang: "cs" })
      .set("X-Cart-Session", CART_SESSION_LANG_CS)
      .expect(200);

    expect(getRes.body).toEqual(postRes.body);
  });

  it("POST /cart/items rejects missing X-Cart-Session", async () => {
    const res = await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .send({ productId: getSuiteProductId("cart"), quantity: 1 })
      .expect(400);
    expect(res.body.message).toMatch(/X-Cart-Session/i);
  });

  it("POST /cart/items adds line and returns cart DTO", async () => {
    const res = await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION)
      .send({ productId: getSuiteProductId("cart"), quantity: 2 })
      .expect(200);

    expect(res.body).toMatchObject({
      cartSessionId: CART_SESSION,
      items: expect.any(Array),
      subtotal: {
        amount: expect.any(Number),
        currencyCode: expect.any(String),
      },
      discount: null,
      total: { amount: expect.any(Number), currencyCode: expect.any(String) },
    });
    const line = (res.body.items as { productId: number; quantity: number }[]).find(
      (i) => i.productId === getSuiteProductId("cart"),
    );
    expect(line?.quantity).toBe(2);
  });

  it("POST /cart/promotion applies MOREISLESS with 2 units → 10% discount", async () => {
    await prisma.cartItem.deleteMany({ where: { cartKey: CART_SESSION_PROMO } });
    await prisma.cartPromotion.deleteMany({
      where: { cartKey: CART_SESSION_PROMO },
    });

    await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_PROMO)
      .send({ productId: getSuiteProductId("cart"), quantity: 2 })
      .expect(200);

    const res = await request(app)
      .post("/cart/promotion")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_PROMO)
      .send({ code: "MoreIsLess" })
      .expect(200);

    expect(res.body.discount).toMatchObject({
      code: "MOREISLESS",
      percent: 10,
    });
    expect(res.body.subtotal.amount).toBeGreaterThan(res.body.total.amount);
    expect(res.body.discount.amount).toBeGreaterThan(0);
  });

  it("POST /cart/promotion rejects unknown promotion code", async () => {
    await prisma.cartItem.deleteMany({ where: { cartKey: CART_SESSION_PROMO } });
    await prisma.cartPromotion.deleteMany({
      where: { cartKey: CART_SESSION_PROMO },
    });

    await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_PROMO)
      .send({ productId: getSuiteProductId("cart"), quantity: 1 })
      .expect(200);

    await request(app)
      .post("/cart/promotion")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_PROMO)
      .send({ code: "UNKNOWN_SHOP_CODE" })
      .expect(400);
  });

  it("POST /cart/items adds exactly one unit of a product (assert in response + GET /cart)", async () => {
    const postRes = await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_SINGLE_ITEM)
      .send({ productId: getSuiteProductId("cart"), quantity: 1 })
      .expect(200);

    type CartLine = { productId: number; quantity: number; name: string };
    const items = postRes.body.items as CartLine[];
    const linesForProduct = items.filter((i) => i.productId === getSuiteProductId("cart"));
    expect(linesForProduct).toHaveLength(1);
    expect(linesForProduct[0]?.quantity).toBe(1);

    const getRes = await request(app)
      .get("/cart")
      .set("X-Cart-Session", CART_SESSION_SINGLE_ITEM)
      .expect(200);

    expect(getRes.body).toEqual(postRes.body);
  });
});
