import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, txExchangeRateUpsert } = vi.hoisted(() => {
  const txExchangeRateUpsert = vi.fn();
  const tx = { exchangeRate: { upsert: txExchangeRateUpsert } };
  const transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof tx) => unknown)(tx);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return {
    mockPrisma: {
      currency: {
        upsert: vi.fn((args: unknown) => Promise.resolve(args)),
        findMany: vi.fn(),
      },
      exchangeRate: {
        upsert: vi.fn(),
      },
      $transaction: transaction,
    },
    txExchangeRateUpsert,
  };
});

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

import { syncDailyCnbExchangeRates } from "../cnbExchangeRateSyncService";

describe("syncDailyCnbExchangeRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.currency.findMany.mockResolvedValue([
      { id: 1, code: "CZK" },
      { id: 2, code: "EUR" },
      { id: 3, code: "USD" },
    ]);
  });

  it("upserts CNB rates and normalizes rate by source amount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          rates: [
            {
              validFor: "2026-04-22",
              currencyCode: "EUR",
              amount: 1,
              rate: 24.5,
            },
            {
              validFor: "2026-04-22",
              currencyCode: "USD",
              amount: 1,
              rate: 20.7,
            },
          ],
        }),
      }),
    );

    const result = await syncDailyCnbExchangeRates(
      new Date("2026-04-22T09:00:00.000Z"),
    );

    expect(result).toEqual({ effectiveDate: "2026-04-22", importedCount: 2 });
    expect(mockPrisma.currency.upsert).toHaveBeenCalledTimes(3);
    expect(txExchangeRateUpsert).toHaveBeenCalledTimes(2);
    expect(txExchangeRateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: "CNB_API",
          sourceAmount: 1,
          exchangeRate: 24.5,
        }),
      }),
    );
  });

  it("falls back to previous day when target date payload is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ rates: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rates: [
              {
                validFor: "2026-04-21",
                currencyCode: "EUR",
                amount: 1,
                rate: 24,
              },
            ],
          }),
        }),
    );

    const result = await syncDailyCnbExchangeRates(
      new Date("2026-04-22T09:00:00.000Z"),
    );

    expect(result).toEqual({ effectiveDate: "2026-04-21", importedCount: 1 });
  });
});
