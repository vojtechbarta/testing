/** Partition fault flags for MoreIsLess (used in tests and runtime). */
export type MoreIsLessPartitionFaults = {
  boundary4: boolean;
  emptyAt10: boolean;
  tier20Plus50: boolean;
};

/** Baseline volume tiers: sum of line quantities → percent off subtotal. */
export function baselineVolumePercent(totalUnits: number): number {
  if (totalUnits <= 1) return 0;
  if (totalUnits === 2) return 10;
  if (totalUnits === 3) return 15;
  return 20;
}

/**
 * Applies injected partition faults on top of the baseline percent.
 * Faults are evaluated in a fixed order; multiple can apply when boundaries overlap by design.
 */
export function applyMoreIsLessPartitionFaults(
  basePercent: number,
  totalUnits: number,
  faults: MoreIsLessPartitionFaults,
): number {
  let p = basePercent;
  if (faults.emptyAt10 && totalUnits === 10) {
    p = 0;
  }
  if (faults.boundary4 && totalUnits === 4) {
    p = 15;
  }
  if (faults.tier20Plus50 && totalUnits >= 20) {
    p = 50;
  }
  return p;
}
