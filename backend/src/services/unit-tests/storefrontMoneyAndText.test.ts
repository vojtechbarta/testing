import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    exchangeRate: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

import { loadEurPerCzkRate, multiplyStorefrontMoney, toStorefrontMoney } from "../../shop/storefrontMoney";
import { storefrontProductDescription, storefrontProductName } from "../../shop/storefrontProductText";

describe("storefrontMoney and storefrontProductText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads positive EUR/CZK rate and converts to number", async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue({ exchangeRate: "24.0" });
    await expect(loadEurPerCzkRate()).resolves.toBe(24);
  });

  it("returns null for missing or invalid non-positive rate", async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
    await expect(loadEurPerCzkRate()).resolves.toBeNull();
    mockPrisma.exchangeRate.findFirst.mockResolvedValue({ exchangeRate: 0 });
    await expect(loadEurPerCzkRate()).resolves.toBeNull();
  });

  it("keeps EUR in en lang and converts EUR->CZK in cs when rate exists", () => {
    expect(toStorefrontMoney(17, "EUR", "en", 24)).toEqual({ amount: 17, currencyCode: "EUR" });
    expect(toStorefrontMoney(17, "EUR", "cs", 24)).toEqual({ amount: 408, currencyCode: "CZK" });
  });

  it("keeps non-CZK non-EUR currency unchanged and keeps EUR rounded", () => {
    expect(toStorefrontMoney(10.126, "EUR", "en", null)).toEqual({
      amount: 10.13,
      currencyCode: "EUR",
    });
    expect(toStorefrontMoney(100, "USD", "en", 24)).toEqual({
      amount: 100,
      currencyCode: "USD",
    });
  });

  it("falls back to storage currency when EUR rate is missing", () => {
    expect(toStorefrontMoney(17, "EUR", "cs", null)).toEqual({
      amount: 17,
      currencyCode: "EUR",
    });
  });

  it("multiplies storefront money with currency-specific rounding", () => {
    expect(multiplyStorefrontMoney({ amount: 16.63, currencyCode: "EUR" }, 3)).toEqual({
      amount: 49.89,
      currencyCode: "EUR",
    });
  });

  it("returns Czech copy for known ids and fallback db text otherwise", () => {
    const knownName = storefrontProductName(1, "Wireless Mouse M200", "cs");
    const knownDesc = storefrontProductDescription(1, "default", "cs");
    expect(knownName).not.toBe("Wireless Mouse M200");
    expect(knownDesc).not.toBe("default");
    expect(storefrontProductName(999, "FallbackName", "cs")).toBe("FallbackName");
    expect(storefrontProductDescription(999, "FallbackDesc", "cs")).toBe("FallbackDesc");
    expect(storefrontProductName(1, "EnglishName", "en")).toBe("EnglishName");
    expect(storefrontProductDescription(1, "EnglishDesc", "en")).toBe("EnglishDesc");
  });
});
