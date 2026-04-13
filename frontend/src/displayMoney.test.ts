import { describe, expect, it } from "vitest";
import {
  convertPriceFilterRangeBetweenDisplayCurrencies,
  toShopDisplayMoney,
} from "./displayMoney";

const rates = [
  { fromCurrencyCode: "EUR", toCurrencyCode: "CZK", exchangeRate: 24 },
];

describe("toShopDisplayMoney", () => {
  it("keeps CZK in Czech UI", () => {
    expect(
      toShopDisplayMoney(399, "CZK", { langIsCs: true, rates }),
    ).toEqual({ amount: 399, currencyCode: "CZK" });
  });

  it("converts CZK to EUR in English UI using EUR→CZK rate", () => {
    expect(
      toShopDisplayMoney(399, "CZK", { langIsCs: false, rates }),
    ).toEqual({ amount: 16.63, currencyCode: "EUR" });
  });

  it("falls back to CZK in English when rate is missing", () => {
    expect(
      toShopDisplayMoney(100, "CZK", { langIsCs: false, rates: [] }),
    ).toEqual({ amount: 100, currencyCode: "CZK" });
  });
});

describe("convertPriceFilterRangeBetweenDisplayCurrencies", () => {
  it("maps EUR band to CZK (×24)", () => {
    expect(
      convertPriceFilterRangeBetweenDisplayCurrencies(
        10,
        20,
        "EUR",
        "CZK",
        rates,
      ),
    ).toEqual({ min: 240, max: 480 });
  });

  it("maps CZK band to EUR (÷24, 2 decimals)", () => {
    expect(
      convertPriceFilterRangeBetweenDisplayCurrencies(
        240,
        480,
        "CZK",
        "EUR",
        rates,
      ),
    ).toEqual({ min: 10, max: 20 });
  });

  it("returns null without rate", () => {
    expect(
      convertPriceFilterRangeBetweenDisplayCurrencies(
        1,
        2,
        "EUR",
        "CZK",
        [],
      ),
    ).toBeNull();
  });
});
