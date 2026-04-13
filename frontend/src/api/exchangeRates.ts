import { apiGet } from "./client";

export type ExchangeRateDto = {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  exchangeRate: number;
};

export function getExchangeRates() {
  return apiGet<ExchangeRateDto[]>("/exchange-rates");
}
