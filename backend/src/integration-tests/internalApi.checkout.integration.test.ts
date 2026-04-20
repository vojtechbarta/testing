import request from "supertest";
import { describe, expect, it } from "vitest";
import { CART_SESSION_CHECKOUT_CS } from "./helpers/cartSessions";
import {
  app,
  getSuiteProductId,
  setupInternalApiSuite,
} from "./helpers/internalApiTestHarness";

const CART_SESSION_GATEWAY_CHECKOUT = "aaaaaaaa-bbbb-4ccc-bddd-000000000105";

describe("Internal API - checkout", () => {
  setupInternalApiSuite({
    suiteId: "checkout",
    cartKeys: [CART_SESSION_CHECKOUT_CS, CART_SESSION_GATEWAY_CHECKOUT],
    dedicatedProduct: true,
  });

  it("POST /checkout/bank-transfer?lang=cs returns Czech message and Czech dummy bank note", async () => {
    await request(app)
      .post("/cart/items")
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_CHECKOUT_CS)
      .query({ lang: "cs" })
      .send({ productId: getSuiteProductId("checkout"), quantity: 1 })
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

  it("POST /checkout/gateway/init creates pending gateway order for valid cart and buyer", async () => {
    await request(app)
      .post("/cart/items")
      .query({ lang: "cs" })
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_GATEWAY_CHECKOUT)
      .send({ productId: getSuiteProductId("checkout"), quantity: 1 })
      .expect(200);

    const res = await request(app)
      .post("/checkout/gateway/init")
      .query({ lang: "cs" })
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_GATEWAY_CHECKOUT)
      .send({
        customerEmail: "gateway-init-ok@example.test",
        customerFirstName: "Test",
        customerLastName: "Buyer",
        customerPhone: "+420123456789",
      })
      .expect(201);

    expect(res.body).toMatchObject({
      order: {
        id: expect.any(Number),
        paymentMethod: "PAYMENT_GATEWAY",
      },
      nextStep: expect.stringContaining("/checkout/gateway/:orderId/mock-pay"),
    });
  });

  it("POST /checkout/gateway/init rejects missing X-Cart-Session", async () => {
    const res = await request(app)
      .post("/checkout/gateway/init")
      .set("Content-Type", "application/json")
      .send({
        customerEmail: "gateway-missing-cart@example.test",
        customerFirstName: "Missing",
        customerLastName: "Session",
        customerPhone: "+420123456789",
      })
      .expect(400);
    expect(res.body.message).toMatch(/X-Cart-Session/i);
  });

  it("POST /checkout/gateway/:orderId/mock-pay returns success for pending gateway order", async () => {
    await request(app)
      .post("/cart/items")
      .query({ lang: "cs" })
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_GATEWAY_CHECKOUT)
      .send({ productId: getSuiteProductId("checkout"), quantity: 1 })
      .expect(200);

    const initRes = await request(app)
      .post("/checkout/gateway/init")
      .query({ lang: "cs" })
      .set("Content-Type", "application/json")
      .set("X-Cart-Session", CART_SESSION_GATEWAY_CHECKOUT)
      .send({
        customerEmail: "gateway-pay-ok@example.test",
        customerFirstName: "Gate",
        customerLastName: "Way",
        customerPhone: "+420123456789",
      })
      .expect(201);

    const orderId = (initRes.body as { order: { id: number } }).order.id;

    const payRes = await request(app)
      .post(`/checkout/gateway/${orderId}/mock-pay`)
      .set("Content-Type", "application/json")
      .expect(200);
    expect(payRes.body).toMatchObject({
      success: expect.any(Boolean),
      orderId,
    });
  });

  it("POST /checkout/gateway/:orderId/mock-pay returns error for missing order", async () => {
    const res = await request(app)
      .post("/checkout/gateway/99999999/mock-pay")
      .set("Content-Type", "application/json")
      .expect(400);
    expect(res.body.message).toMatch(/Order not found/i);
  });

  it("POST /checkout/gateway/:orderId/mock-pay handles invalid route param format", async () => {
    const res = await request(app)
      .post("/checkout/gateway/not-a-number/mock-pay")
      .set("Content-Type", "application/json");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(600);
  });
});
