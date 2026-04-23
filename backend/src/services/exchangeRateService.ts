import prisma from "../db/prisma";

export type ExchangeRateDto = {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  exchangeRate: number;
  sourceAmount: number;
  source: string;
  effectiveDate: string;
  isStale: boolean;
};

export async function getAllExchangeRates(): Promise<ExchangeRateDto[]> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const rows = await prisma.exchangeRate.findMany({
    include: { fromCurrency: true, toCurrency: true },
    orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
  });
  const latestByPair = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.fromCurrencyId}:${row.toCurrencyId}`;
    if (!latestByPair.has(key)) {
      latestByPair.set(key, row);
    }
  }
  return [...latestByPair.values()].map((r) => {
    const effectiveDate = r.effectiveDate.toISOString().slice(0, 10);
    return {
      fromCurrencyCode: r.fromCurrency.code,
      toCurrencyCode: r.toCurrency.code,
      exchangeRate: Number(r.exchangeRate),
      sourceAmount: r.sourceAmount,
      source: r.source,
      effectiveDate,
      isStale: effectiveDate !== todayIso,
    };
  });
}

/** Same EUR→CZK numeric rate as exposed by GET /exchange-rates (authoritative for storefront conversion). */
export async function getLatestEurToCzkRate(): Promise<number | null> {
  const rates = await getAllExchangeRates();
  const hit = rates.find(
    (r) => r.fromCurrencyCode === "EUR" && r.toCurrencyCode === "CZK",
  );
  if (!hit || !(hit.exchangeRate > 0)) return null;
  return hit.exchangeRate;
}
