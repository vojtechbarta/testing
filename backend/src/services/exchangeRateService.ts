import prisma from "../db/prisma";

export type ExchangeRateDto = {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  exchangeRate: number;
};

export async function getAllExchangeRates(): Promise<ExchangeRateDto[]> {
  const rows = await prisma.exchangeRate.findMany({
    include: { fromCurrency: true, toCurrency: true },
  });
  return rows.map((r) => ({
    fromCurrencyCode: r.fromCurrency.code,
    toCurrencyCode: r.toCurrency.code,
    exchangeRate: Number(r.exchangeRate),
  }));
}
