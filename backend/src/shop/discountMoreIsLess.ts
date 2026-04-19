import { FAULT_KEYS, isFaultEnabled } from "../faults/faultRuntime";
import {
  applyMoreIsLessPartitionFaults,
  baselineVolumePercent,
} from "./discountPolicies";

export const PROMO_CODE_MORE_IS_LESS = "MOREISLESS";

/** Trim and uppercase for comparisons and storage. */
export function normalizePromotionCode(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase();
}

export function canonicalPromotionCode(
  normalizedUpper: string,
): typeof PROMO_CODE_MORE_IS_LESS | null {
  if (normalizedUpper === PROMO_CODE_MORE_IS_LESS) {
    return PROMO_CODE_MORE_IS_LESS;
  }
  return null;
}

export async function resolveMoreIsLessFinalPercent(
  totalUnits: number,
): Promise<number> {
  const base = baselineVolumePercent(totalUnits);
  const faults = {
    boundary4: await isFaultEnabled(FAULT_KEYS.discountMoreIsLessBoundary4),
    emptyAt10: await isFaultEnabled(FAULT_KEYS.discountMoreIsLessEmptyAt10),
    tier20Plus50: await isFaultEnabled(FAULT_KEYS.discountMoreIsLessTier20Plus50),
  };
  return applyMoreIsLessPartitionFaults(base, totalUnits, faults);
}
