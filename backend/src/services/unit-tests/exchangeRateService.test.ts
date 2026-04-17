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

import { getAllExchangeRates } from "../exchangeRateService";

describe("exchangeRateService.getAllExchangeRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps prisma rows to dto shape with numeric exchangeRate", async () => {
    mockPrisma.exchangeRate.findMany.mockResolvedValue([
      {
        fromCurrency: { code: "EUR" },
        toCurrency: { code: "CZK" },
        exchangeRate: "24.00",
      },
    ]);

    const rows = await getAllExchangeRates();

    expect(rows).toEqual([
      {
        fromCurrencyCode: "EUR",
        toCurrencyCode: "CZK",
        exchangeRate: 24,
      },
    ]);
  });
});
