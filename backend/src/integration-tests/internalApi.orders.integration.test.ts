import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, getSuiteProductId, setupInternalApiSuite } from "./helpers/internalApiTestHarness";

describe("Internal API - orders", () => {
  setupInternalApiSuite({ suiteId: "orders", dedicatedProduct: true });

  it("POST /orders creates direct order for valid payload", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Content-Type", "application/json")
      .send({
        userId: 1,
        items: [{ productId: getSuiteProductId("orders"), quantity: 1 }],
      })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(Number),
      total: expect.any(Number),
      items: expect.any(Array),
    });
  });

  it("POST /orders rejects invalid payload", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Content-Type", "application/json")
      .send({ userId: 1, items: [] })
      .expect(400);
    expect(res.body.message).toMatch(/Invalid order payload/i);
  });
});
