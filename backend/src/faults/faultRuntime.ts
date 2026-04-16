import prisma from "../db/prisma";

// Fault keys používané pro injekce konkrétních chyb.
// Důležité: musí sedět s `FaultConfig.key` v DB (seed/admin).
export const FAULT_KEYS = {
  uiCartAddDoubleRequest: "cart_add_ui_double_call",
  uiConsoleErrorEveryMinute: "console_error_every_minute",
  uiInjectErrorNetworkEveryMinute: "network_inject_api_fail_every minute",
  apiCartAddDoubleQuantityPayload: "cart_add_api_double_quantity_payload",
  apiCheckoutEmailWrongLanguage: "checkout_email_wrong_language",
  unitCartAddDoubleQuantityPersist: "cart_add_unit_double_quantity_persist",
  apiSortPriceAscSwapLastTwo: "sort_price_asc_swap_last_two",
  apiSortNameDescSwapLastTwo: "sort_name_desc_swap_last_two",
  apiProductsOddMinuteDelay: "products_api_odd_minute_wait_to_even",
  uiGridNonChromeBroken: "grid_non_chrome_broken",
  uiLabelTypos: "ui_label_typos",
} as const;

type FaultRuntimeRow = {
  key: string;
  enabled: boolean;
  level: string;
  failureRate: number | null;
};

const CACHE_TTL_MS = 1000;
let cachedAt = 0;
let cachedEnabledByKey: Record<string, boolean> = {};
let cachedFailureRateByKey: Record<string, number | null> = {};
let cachedUiEnabledKeys: Array<{ key: string; failureRate: number | null }> = [];

async function refreshCacheIfNeeded() {
  const now = Date.now();
  // Skip only after a successful warm-up; avoid `&& cachedUiEnabledKeys` (empty [] is still truthy in JS).
  if (cachedAt > 0 && now - cachedAt < CACHE_TTL_MS) {
    return;
  }

  const faults = await prisma.faultConfig.findMany({
    select: { key: true, enabled: true, level: true, failureRate: true },
  });

  cachedEnabledByKey = {};
  cachedFailureRateByKey = {};
  cachedUiEnabledKeys = [];

  for (const f of faults) {
    cachedEnabledByKey[f.key] = f.enabled;
    cachedFailureRateByKey[f.key] = f.failureRate;
    if (f.enabled && f.level === "UI") {
      cachedUiEnabledKeys.push({ key: f.key, failureRate: f.failureRate });
    }
  }

  cachedAt = now;
}

export async function isFaultEnabled(key: string): Promise<boolean> {
  await refreshCacheIfNeeded();
  return cachedEnabledByKey[key] ?? false;
}

export async function shouldTriggerFault(key: string): Promise<boolean> {
  await refreshCacheIfNeeded();
  const enabled = cachedEnabledByKey[key] ?? false;
  if (!enabled) return false;

  const failureRate = cachedFailureRateByKey[key];
  // pokud není nastaveno, chováme se jako "vždy".
  if (failureRate === null || failureRate === undefined) return true;

  const rateClamped = Math.max(0, Math.min(1, failureRate));
  return Math.random() < rateClamped;
}

export async function listEnabledUiFaultConfigs(): Promise<
  Array<{ key: string; failureRate: number }>
> {
  await refreshCacheIfNeeded();
  return cachedUiEnabledKeys.map((f) => ({
    key: f.key,
    // null = vždy
    failureRate:
      f.failureRate === null || f.failureRate === undefined
        ? 1
        : Math.max(0, Math.min(1, f.failureRate)),
  }));
}

/** Call after admin updates FaultConfig so /faults/ui and shouldTriggerFault see changes immediately. */
export function invalidateFaultRuntimeCache(): void {
  cachedAt = 0;
}

