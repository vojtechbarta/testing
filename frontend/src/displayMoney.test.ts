import { describe, expect, it } from "vitest";
import {
  convertPriceFilterRangeBetweenDisplayCurrencies,
  toShopDisplayMoney,
} from "./displayMoney";

const rates = [
  { fromCurrencyCode: "EUR", toCurrencyCode: "CZK", exchangeRate: 24 },
];

describe("toShopDisplayMoney", () => {
  it("keeps EUR in English UI", () => {
    expect(
      toShopDisplayMoney(17, "EUR", { langIsCs: false, rates }),
    ).toEqual({ amount: 17, currencyCode: "EUR" });
  });

  it("converts EUR to CZK in Czech UI using EUR→CZK rate", () => {
    expect(
      toShopDisplayMoney(17, "EUR", { langIsCs: true, rates }),
    ).toEqual({ amount: 408, currencyCode: "CZK" });
  });

  it("falls back to EUR in Czech when rate is missing", () => {
    expect(
      toShopDisplayMoney(17, "EUR", { langIsCs: true, rates: [] }),
    ).toEqual({ amount: 17, currencyCode: "EUR" });
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
