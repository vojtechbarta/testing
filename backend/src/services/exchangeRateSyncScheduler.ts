import { syncDailyCnbExchangeRates } from "./cnbExchangeRateSyncService";

const PRAGUE_TIMEZONE = "Europe/Prague";
const SYNC_HOUR = Number(process.env.FX_SYNC_HOUR_PRAGUE ?? 15);
const POLL_INTERVAL_MS = Number(process.env.FX_SYNC_POLL_INTERVAL_MS ?? 15 * 60 * 1000);

let timer: NodeJS.Timeout | null = null;
let lastAttemptedLocalDate: string | null = null;
let lastSuccessfulSyncAt: string | null = null;
let lastImportedCount = 0;

function getPragueParts(now = new Date()): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRAGUE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

async function trySyncOnce(): Promise<void> {
  const { date, hour } = getPragueParts();
  if (hour < SYNC_HOUR || lastAttemptedLocalDate === date) {
    return;
  }
  lastAttemptedLocalDate = date;
  try {
    const result = await syncDailyCnbExchangeRates();
    lastSuccessfulSyncAt = new Date().toISOString();
    lastImportedCount = result.importedCount;
    // eslint-disable-next-line no-console
    console.log(
      `[fx-sync] success source=CNB_API effectiveDate=${result.effectiveDate} imported=${result.importedCount}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error(`[fx-sync] failed date=${date}: ${message}`);
  }
}

export function startExchangeRateSyncScheduler(): void {
  if (process.env.NODE_ENV === "test" || process.env.FX_SYNC_ENABLED === "false") {
    return;
  }
  if (timer) {
    return;
  }
  void trySyncOnce();
  timer = setInterval(() => {
    void trySyncOnce();
  }, POLL_INTERVAL_MS);
}

export function getExchangeRateSyncStatus(): {
  lastSuccessfulSyncAt: string | null;
  lastImportedCount: number;
  lastAttemptedLocalDate: string | null;
} {
  return {
    lastSuccessfulSyncAt,
    lastImportedCount,
    lastAttemptedLocalDate,
  };
}

export function resetExchangeRateSyncSchedulerForTests(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  lastAttemptedLocalDate = null;
  lastSuccessfulSyncAt = null;
  lastImportedCount = 0;
}
