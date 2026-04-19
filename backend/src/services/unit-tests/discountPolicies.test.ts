import { describe, expect, it } from "vitest";
import {
  applyMoreIsLessPartitionFaults,
  baselineVolumePercent,
} from "../../shop/discountPolicies";

describe("discountPolicies (MoreIsLess)", () => {
  describe("baselineVolumePercent", () => {
    it("returns 0 for 0 or 1 units", () => {
      expect(baselineVolumePercent(0)).toBe(0);
      expect(baselineVolumePercent(1)).toBe(0);
    });
    it("returns tier boundaries 2→10%, 3→15%, 4+→20%", () => {
      expect(baselineVolumePercent(2)).toBe(10);
      expect(baselineVolumePercent(3)).toBe(15);
      expect(baselineVolumePercent(4)).toBe(20);
      expect(baselineVolumePercent(99)).toBe(20);
    });
  });

  describe("applyMoreIsLessPartitionFaults", () => {
    const noFaults = {
      boundary4: false,
      emptyAt10: false,
      tier20Plus50: false,
    };

    it("leaves baseline when no faults", () => {
      expect(
        applyMoreIsLessPartitionFaults(20, 5, noFaults),
      ).toBe(20);
    });

    it("boundary-4 fault forces 15% at exactly 4 units", () => {
      expect(
        applyMoreIsLessPartitionFaults(20, 4, {
          ...noFaults,
          boundary4: true,
        }),
      ).toBe(15);
    });

    it("empty-at-10 fault forces 0% at exactly 10 units", () => {
      expect(
        applyMoreIsLessPartitionFaults(20, 10, {
          ...noFaults,
          emptyAt10: true,
        }),
      ).toBe(0);
    });

    it("tier-20+ fault forces 50% at 20+ units", () => {
      expect(
        applyMoreIsLessPartitionFaults(20, 20, {
          ...noFaults,
          tier20Plus50: true,
        }),
      ).toBe(50);
      expect(
        applyMoreIsLessPartitionFaults(20, 100, {
          ...noFaults,
          tier20Plus50: true,
        }),
      ).toBe(50);
    });
  });
});
