import prisma from "../db/prisma";

// Fault keys používané pro injekce konkrétních chyb.
// Důležité: musí sedět s `FaultConfig.key` v DB (seed/admin).
export const FAULT_KEYS = {
  uiCartAddDoubleRequest: "cart_add_ui_double_call",
  apiCartAddDoubleQuantityPayload: "cart_add_api_double_quantity_payload",
  unitCartAddDoubleQuantityPersist: "cart_add_unit_double_quantity_persist",
} as const;

type FaultRuntimeRow = {
  key: string;
  enabled: boolean;
  level: string;
};

const CACHE_TTL_MS = 1000;
let cachedAt = 0;
let cachedEnabledByKey: Record<string, boolean> = {};
let cachedUiEnabledKeys: string[] = [];

async function refreshCacheIfNeeded() {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS && cachedUiEnabledKeys) {
    return;
  }

  const faults = await prisma.faultConfig.findMany({
    select: { key: true, enabled: true, level: true },
  });

  cachedEnabledByKey = {};
  cachedUiEnabledKeys = [];

  for (const f of faults) {
    cachedEnabledByKey[f.key] = f.enabled;
    if (f.enabled && f.level === "UI") {
      cachedUiEnabledKeys.push(f.key);
    }
  }

  cachedAt = now;
}

export async function isFaultEnabled(key: string): Promise<boolean> {
  await refreshCacheIfNeeded();
  return cachedEnabledByKey[key] ?? false;
}

export async function listEnabledUiFaultKeys(): Promise<string[]> {
  await refreshCacheIfNeeded();
  return cachedUiEnabledKeys;
}

