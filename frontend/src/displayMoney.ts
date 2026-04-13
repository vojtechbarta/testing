import type { ExchangeRateDto } from "./api/exchangeRates";

export type { ExchangeRateDto };

/**
 * DB semantics: 1 unit of `fromCurrency` equals `exchangeRate` units of `toCurrency`
 * (e.g. from EUR to CZK with rate 24 → 1 EUR = 24 CZK).
 */
export function findDirectRate(
  rates: ExchangeRateDto[],
  fromCode: string,
  toCode: string,
): number | undefined {
  const row = rates.find(
    (r) => r.fromCurrencyCode === fromCode && r.toCurrencyCode === toCode,
  );
  return row ? row.exchangeRate : undefined;
}

function roundForCurrency(amount: number, currencyCode: string): number {
  const decimals = currencyCode === "CZK" ? 0 : 2;
  const f = 10 ** decimals;
  return Math.round(amount * f) / f;
}

export type ShopDisplayMoneyContext = {
  langIsCs: boolean;
  rates: ExchangeRateDto[];
};

/**
 * English storefront shows prices in EUR when API amounts are in CZK and EUR→CZK exists.
 * Czech storefront and admin/API storage stay in the original currency.
 */
export function toShopDisplayMoney(
  amount: number,
  storageCurrencyCode: string,
  ctx: ShopDisplayMoneyContext,
): { amount: number; currencyCode: string } {
  if (ctx.langIsCs) {
    return { amount, currencyCode: storageCurrencyCode };
  }
  if (storageCurrencyCode === "EUR") {
    return { amount: roundForCurrency(amount, "EUR"), currencyCode: "EUR" };
  }
  if (storageCurrencyCode !== "CZK") {
    return { amount, currencyCode: storageCurrencyCode };
  }
  const czkPerEur = findDirectRate(ctx.rates, "EUR", "CZK");
  if (czkPerEur === undefined || czkPerEur === 0) {
    return { amount, currencyCode: storageCurrencyCode };
  }
  const eur = amount / czkPerEur;
  return { amount: roundForCurrency(eur, "EUR"), currencyCode: "EUR" };
}

/**
 * When the shop grid switches display between CZK and EUR (language or rates),
 * re-map the price slider range so the same economic band is kept.
 * Returns null if conversion is not possible (missing rate or unknown pair).
 */
export function convertPriceFilterRangeBetweenDisplayCurrencies(
  min: number,
  max: number,
  fromCode: string,
  toCode: string,
  rates: ExchangeRateDto[],
): { min: number; max: number } | null {
  if (fromCode === toCode) {
    return { min, max };
  }
  const rate = findDirectRate(rates, "EUR", "CZK");
  if (rate === undefined || rate === 0) {
    return null;
  }
  let nextMin: number;
  let nextMax: number;
  if (fromCode === "EUR" && toCode === "CZK") {
    nextMin = Math.round(min * rate);
    nextMax = Math.round(max * rate);
  } else if (fromCode === "CZK" && toCode === "EUR") {
    nextMin = roundForCurrency(min / rate, "EUR");
    nextMax = roundForCurrency(max / rate, "EUR");
  } else {
    return null;
  }
  return {
    min: Math.min(nextMin, nextMax),
    max: Math.max(nextMin, nextMax),
  };
}
