import { getLatestEurToCzkRate } from "../services/exchangeRateService";

export type StorefrontLang = "en" | "cs";

/** Delegates to {@link getLatestEurToCzkRate} so catalog/cart match GET /exchange-rates. */
export async function loadEurPerCzkRate(): Promise<number | null> {
  return getLatestEurToCzkRate();
}

function roundForCurrency(amount: number, currencyCode: string): number {
  const decimals = currencyCode === "CZK" ? 0 : 2;
  const f = 10 ** decimals;
  return Math.round(amount * f) / f;
}

/**
 * Storefront display money: EN keeps EUR storage; CS converts EUR to CZK when rate exists.
 */
export function toStorefrontMoney(
  amount: number,
  storageCurrencyCode: string,
  lang: StorefrontLang,
  eurPerCzk: number | null,
): { amount: number; currencyCode: string } {
  if (lang === "en") {
    return {
      amount: roundForCurrency(amount, storageCurrencyCode),
      currencyCode: storageCurrencyCode,
    };
  }
  if (storageCurrencyCode !== "EUR") {
    return { amount, currencyCode: storageCurrencyCode };
  }
  if (eurPerCzk === null) {
    return { amount, currencyCode: storageCurrencyCode };
  }
  const czk = amount * eurPerCzk;
  return { amount: roundForCurrency(czk, "CZK"), currencyCode: "CZK" };
}

export function multiplyStorefrontMoney(
  unit: { amount: number; currencyCode: string },
  quantity: number,
): { amount: number; currencyCode: string } {
  const raw = unit.amount * quantity;
  return {
    amount: roundForCurrency(raw, unit.currencyCode),
    currencyCode: unit.currencyCode,
  };
}
