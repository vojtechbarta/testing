import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    exchangeRate: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

import { getAllExchangeRates, getLatestEurToCzkRate } from "../exchangeRateService";

describe("exchangeRateService.getAllExchangeRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps prisma rows to dto shape with numeric exchangeRate", async () => {
    mockPrisma.exchangeRate.findMany.mockResolvedValue([
      {
        id: 11,
        fromCurrencyId: 1,
        toCurrencyId: 2,
        fromCurrency: { code: "EUR" },
        toCurrency: { code: "CZK" },
        sourceAmount: 1,
        source: "CNB_API",
        effectiveDate: new Date("2026-04-22T00:00:00.000Z"),
        exchangeRate: "24.00",
      },
    ]);

    const rows = await getAllExchangeRates();

    expect(rows).toEqual([
      {
        fromCurrencyCode: "EUR",
        toCurrencyCode: "CZK",
        sourceAmount: 1,
        exchangeRate: 24,
        source: "CNB_API",
        effectiveDate: "2026-04-22",
        isStale: expect.any(Boolean),
      },
    ]);
  });

  it("getLatestEurToCzkRate returns EUR→CZK numeric rate from latest pair", async () => {
    mockPrisma.exchangeRate.findMany.mockResolvedValue([
      {
        id: 11,
        fromCurrencyId: 1,
        toCurrencyId: 2,
        fromCurrency: { code: "EUR" },
        toCurrency: { code: "CZK" },
        sourceAmount: 1,
        source: "CNB_API",
        effectiveDate: new Date("2026-04-22T00:00:00.000Z"),
        exchangeRate: "24.35",
      },
    ]);

    await expect(getLatestEurToCzkRate()).resolves.toBe(24.35);
  });

  it("getLatestEurToCzkRate returns null when no EUR→CZK row", async () => {
    mockPrisma.exchangeRate.findMany.mockResolvedValue([]);
    await expect(getLatestEurToCzkRate()).resolves.toBeNull();
  });
});
