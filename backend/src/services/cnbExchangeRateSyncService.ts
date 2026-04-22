import prisma from "../db/prisma";

const CNB_SOURCE = "CNB_API";
const CZK_CODE = "CZK";
const CNB_DAILY_URL = "https://api.cnb.cz/cnbapi/exrates/daily?lang=EN";

type CnbDailyRate = {
  validFor: string;
  currencyCode: string;
  amount: number;
  rate: number;
};

type CnbDailyResponse = {
  rates?: CnbDailyRate[];
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00.000Z`);
}

async function fetchCnbDailyRates(dateIso: string): Promise<CnbDailyRate[]> {
  const response = await fetch(`${CNB_DAILY_URL}&date=${dateIso}`);
  if (!response.ok) {
    throw new Error(`CNB daily rates fetch failed: ${response.status}`);
  }
  const payload = (await response.json()) as CnbDailyResponse;
  return payload.rates ?? [];
}

async function resolveCnbRatesWithFallback(
  targetDateIso: string,
): Promise<{ effectiveDate: string; rates: CnbDailyRate[] }> {
  for (let i = 0; i <= 7; i += 1) {
    const probe = new Date(`${targetDateIso}T00:00:00.000Z`);
    probe.setUTCDate(probe.getUTCDate() - i);
    const probeIso = toIsoDate(probe);
    const rates = await fetchCnbDailyRates(probeIso);
    if (rates.length > 0) {
      return { effectiveDate: rates[0]?.validFor ?? probeIso, rates };
    }
  }
  throw new Error("CNB rates are unavailable for last 7 days");
}

export async function syncDailyCnbExchangeRates(targetDate = new Date()): Promise<{
  effectiveDate: string;
  importedCount: number;
}> {
  const targetDateIso = toIsoDate(targetDate);
  const { effectiveDate, rates } = await resolveCnbRatesWithFallback(targetDateIso);

  if (rates.length === 0) {
    throw new Error("CNB returned empty rates payload");
  }

  const currencyCodes = new Set<string>([CZK_CODE]);
  for (const rate of rates) {
    currencyCodes.add(rate.currencyCode);
  }

  const codes = [...currencyCodes];
  await prisma.$transaction(
    codes.map((code) =>
      prisma.currency.upsert({
        where: { code },
        update: {},
        create: { code },
      }),
    ),
  );

  const currencies = await prisma.currency.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const byCode = new Map(currencies.map((c) => [c.code, c.id]));
  const czkId = byCode.get(CZK_CODE);
  if (!czkId) {
    throw new Error("CZK currency is missing");
  }

  const effectiveDateValue = parseIsoDate(effectiveDate);
  let importedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rates) {
      const fromCurrencyId = byCode.get(row.currencyCode);
      if (!fromCurrencyId || !row.amount || row.rate <= 0) {
        continue;
      }
      await tx.exchangeRate.upsert({
        where: {
          exrate_src_day_pair_uq: {
            source: CNB_SOURCE,
            effectiveDate: effectiveDateValue,
            fromCurrencyId,
            toCurrencyId: czkId,
          },
        },
        update: {
          sourceAmount: row.amount,
          exchangeRate: row.rate / row.amount,
        },
        create: {
          source: CNB_SOURCE,
          effectiveDate: effectiveDateValue,
          sourceAmount: row.amount,
          fromCurrencyId,
          toCurrencyId: czkId,
          exchangeRate: row.rate / row.amount,
        },
      });
      importedCount += 1;
    }
  });

  return { effectiveDate, importedCount };
}
