import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { loginAsAdmin, loginAsTester } from "./helpers/auth";
import { app, setupInternalApiSuite } from "./helpers/internalApiTestHarness";

const { syncDailyCnbExchangeRatesMock } = vi.hoisted(() => ({
  syncDailyCnbExchangeRatesMock: vi.fn(),
}));

vi.mock("../services/cnbExchangeRateSyncService", () => ({
  syncDailyCnbExchangeRates: syncDailyCnbExchangeRatesMock,
}));

describe("Internal API - exchange-rates", () => {
  setupInternalApiSuite();

  it("POST /exchange-rates/sync-now without token is 401", async () => {
    await request(app).post("/exchange-rates/sync-now").send({}).expect(401);
  });

  it("POST /exchange-rates/sync-now with admin token is 403", async () => {
    const token = await loginAsAdmin();
    await request(app)
      .post("/exchange-rates/sync-now")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it("POST /exchange-rates/sync-now with invalid date is 400", async () => {
    const token = await loginAsTester();
    await request(app)
      .post("/exchange-rates/sync-now")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2026-02-31" })
      .expect(400);
  });

  it("POST /exchange-rates/sync-now with tester token triggers sync and returns summary", async () => {
    syncDailyCnbExchangeRatesMock.mockResolvedValueOnce({
      effectiveDate: "2026-04-22",
      importedCount: 30,
    });
    const token = await loginAsTester();
    const res = await request(app)
      .post("/exchange-rates/sync-now")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2026-04-22" })
      .expect(200);

    expect(res.body).toEqual({ effectiveDate: "2026-04-22", importedCount: 30 });
    expect(syncDailyCnbExchangeRatesMock).toHaveBeenCalledTimes(1);
    expect(syncDailyCnbExchangeRatesMock).toHaveBeenCalledWith(expect.any(Date));
  });
});
