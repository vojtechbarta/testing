import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, setupInternalApiSuite } from "./helpers/internalApiTestHarness";

describe("Internal API - system", () => {
  setupInternalApiSuite();

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /exchange-rates returns latest available EUR→CZK rate row", async () => {
    const res = await request(app).get("/exchange-rates").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const rows = res.body as {
      fromCurrencyCode: string;
      toCurrencyCode: string;
      sourceAmount: number;
      exchangeRate: number;
      source: string;
      effectiveDate: string;
      isStale: boolean;
    }[];
    const eurCzk = rows.find(
      (r) => r.fromCurrencyCode === "EUR" && r.toCurrencyCode === "CZK",
    );
    expect(eurCzk).toBeDefined();
    expect(eurCzk!.exchangeRate).toBeGreaterThan(0);
    expect(eurCzk!.sourceAmount).toBeGreaterThan(0);
    expect(typeof eurCzk!.source).toBe("string");
    expect(eurCzk!.source.length).toBeGreaterThan(0);
    expect(eurCzk!.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof eurCzk!.isStale).toBe("boolean");
  });

  it("GET /exchange-rates/sync-status returns scheduler metrics payload", async () => {
    const res = await request(app).get("/exchange-rates/sync-status").expect(200);
    expect(res.body).toMatchObject({
      lastSuccessfulSyncAt: null,
      lastImportedCount: expect.any(Number),
      lastAttemptedLocalDate: null,
    });
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
