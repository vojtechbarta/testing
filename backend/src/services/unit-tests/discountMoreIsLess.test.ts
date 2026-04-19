import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockIsFaultEnabled } = vi.hoisted(() => ({
  mockIsFaultEnabled: vi.fn(),
}));

vi.mock("../../faults/faultRuntime", () => ({
  FAULT_KEYS: {
    discountMoreIsLessBoundary4: "discount_more_is_less_boundary_4",
    discountMoreIsLessEmptyAt10: "discount_more_is_less_empty_at_10",
    discountMoreIsLessTier20Plus50: "discount_more_is_less_tier_20_plus_50pct",
  },
  isFaultEnabled: mockIsFaultEnabled,
}));

import {
  canonicalPromotionCode,
  normalizePromotionCode,
  PROMO_CODE_MORE_IS_LESS,
  resolveMoreIsLessFinalPercent,
} from "../../shop/discountMoreIsLess";

describe("discountMoreIsLess", () => {
  beforeEach(() => {
    mockIsFaultEnabled.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizePromotionCode", () => {
    it("normalizes nullish and trims to uppercase", () => {
      expect(normalizePromotionCode(null)).toBe("");
      expect(normalizePromotionCode(undefined)).toBe("");
      expect(normalizePromotionCode("  more is less  ")).toBe("MORE IS LESS");
    });
  });

  describe("canonicalPromotionCode", () => {
    it("accepts only MOREISLESS token", () => {
      expect(canonicalPromotionCode(PROMO_CODE_MORE_IS_LESS)).toBe(
        PROMO_CODE_MORE_IS_LESS,
      );
      expect(canonicalPromotionCode("SAVE20")).toBeNull();
      expect(canonicalPromotionCode("")).toBeNull();
    });
  });

  describe("resolveMoreIsLessFinalPercent", () => {
    it("returns baseline tier when no partition faults are enabled", async () => {
      expect(await resolveMoreIsLessFinalPercent(1)).toBe(0);
      expect(await resolveMoreIsLessFinalPercent(2)).toBe(10);
      expect(await resolveMoreIsLessFinalPercent(5)).toBe(20);
    });

    it("queries fault flags for partition keys", async () => {
      await resolveMoreIsLessFinalPercent(3);
      expect(mockIsFaultEnabled).toHaveBeenCalledTimes(3);
    });

    it("applies boundary-4 fault on top of baseline", async () => {
      mockIsFaultEnabled.mockImplementation(async (key: string) =>
        key === "discount_more_is_less_boundary_4",
      );
      expect(await resolveMoreIsLessFinalPercent(4)).toBe(15);
    });

    it("applies empty-at-10 fault", async () => {
      mockIsFaultEnabled.mockImplementation(async (key: string) =>
        key === "discount_more_is_less_empty_at_10",
      );
      expect(await resolveMoreIsLessFinalPercent(10)).toBe(0);
    });

    it("applies tier-20+ 50% fault", async () => {
      mockIsFaultEnabled.mockImplementation(async (key: string) =>
        key === "discount_more_is_less_tier_20_plus_50pct",
      );
      expect(await resolveMoreIsLessFinalPercent(20)).toBe(50);
      expect(await resolveMoreIsLessFinalPercent(21)).toBe(50);
    });

    it("combines overlapping fault effects in fixed order", async () => {
      mockIsFaultEnabled.mockResolvedValue(true);
      expect(await resolveMoreIsLessFinalPercent(10)).toBe(0);
      expect(await resolveMoreIsLessFinalPercent(4)).toBe(15);
      expect(await resolveMoreIsLessFinalPercent(25)).toBe(50);
    });
  });
});
