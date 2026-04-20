import request from "supertest";
import { describe, expect, it } from "vitest";
import { loginAsTester } from "./helpers/auth";
import { app, setupInternalApiSuite } from "./helpers/internalApiTestHarness";

describe("Internal API - faults", () => {
  setupInternalApiSuite();

  it("GET /faults/inject-error returns 400 with Czech message when lang=cs", async () => {
    const res = await request(app).get("/faults/inject-error").query({ lang: "cs" }).expect(400);
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

  it("GET /admin/faults without token is 401", async () => {
    await request(app).get("/admin/faults").expect(401);
  });

  it("GET /admin/faults returns fault list for tester token", async () => {
    const token = await loginAsTester();
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
    const token = await loginAsTester();
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
});
