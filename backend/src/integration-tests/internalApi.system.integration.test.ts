import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, setupInternalApiSuite } from "./helpers/internalApiTestHarness";

describe("Internal API - system", () => {
  setupInternalApiSuite();

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
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

  it("GET /docs-json returns OpenAPI document", async () => {
    const res = await request(app).get("/docs-json").expect(200);
    expect(res.body).toMatchObject({
      openapi: expect.any(String),
      info: expect.any(Object),
      paths: expect.any(Object),
    });
  });
});
