import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveMoreIsLessPercent, mockIsFaultEnabled } = vi.hoisted(() => ({
  mockResolveMoreIsLessPercent: vi.fn(),
  mockIsFaultEnabled: vi.fn(),
}));

vi.mock("../../shop/discountMoreIsLess", () => ({
  normalizePromotionCode: (s: string | null | undefined) =>
    String(s ?? "").trim().toUpperCase(),
  canonicalPromotionCode: (s: string) =>
    s === "MOREISLESS" ? "MOREISLESS" : null,
  resolveMoreIsLessFinalPercent: (...args: unknown[]) =>
    mockResolveMoreIsLessPercent(...args),
}));

vi.mock("../../faults/faultService", () => ({
  isFaultEnabled: mockIsFaultEnabled,
}));

import type { PricingCartRow } from "../checkoutOrderPricing";
import { computeStorageOrderPricing } from "../checkoutOrderPricing";

function cartLine(price: number, quantity: number): PricingCartRow {
  return {
    productId: 1,
    quantity,
    product: {
      price,
      currency: { code: "CZK", id: 1 },
    },
  } as PricingCartRow;
}

describe("checkoutOrderPricing.computeStorageOrderPricing", () => {
  beforeEach(() => {
    mockIsFaultEnabled.mockReturnValue(false);
    mockResolveMoreIsLessPercent.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sums storage prices with no promotion", async () => {
    const rows = [cartLine(400, 2), cartLine(50, 1)];
    const out = await computeStorageOrderPricing(rows, null);

    expect(out).toEqual({
      grossSubtotal: 850,
      discountAmount: 0,
      discountPercent: null,
      discountCode: null,
      orderTotal: 850,
    });
    expect(mockResolveMoreIsLessPercent).not.toHaveBeenCalled();
  });

  it("treats null promotion the same as missing appliedCode", async () => {
    const rows = [cartLine(100, 1)];
    const withNullCode = await computeStorageOrderPricing(rows, {
      appliedCode: null,
    });
    expect(withNullCode.discountAmount).toBe(0);
    expect(withNullCode.discountCode).toBeNull();
  });

  it("ignores whitespace-only promotion code", async () => {
    const out = await computeStorageOrderPricing([cartLine(100, 1)], {
      appliedCode: "   ",
    });
    expect(out.discountCode).toBeNull();
    expect(out.orderTotal).toBe(100);
  });

  it("applies MoreIsLess percent from volume-based resolver", async () => {
    mockResolveMoreIsLessPercent.mockResolvedValue(20);
    const rows = [cartLine(100, 2)];

    const out = await computeStorageOrderPricing(rows, {
      appliedCode: "moreisless",
    });

    expect(mockResolveMoreIsLessPercent).toHaveBeenCalledWith(2);
    expect(out.discountPercent).toBe(20);
    expect(out.discountCode).toBe("MOREISLESS");
    expect(out.discountAmount).toBe(40);
    expect(out.grossSubtotal).toBe(200);
    expect(out.orderTotal).toBe(160);
  });

  it("does not discount when code is not a canonical promotion", async () => {
    const out = await computeStorageOrderPricing([cartLine(50, 1)], {
      appliedCode: "SPRING50",
    });
    expect(out.discountAmount).toBe(0);
    expect(out.discountCode).toBeNull();
    expect(mockResolveMoreIsLessPercent).not.toHaveBeenCalled();
  });

  it("floors order total when cart_price_miscalculation fault is on", async () => {
    mockIsFaultEnabled.mockImplementation(
      (key: string) => key === "cart_price_miscalculation",
    );
    const out = await computeStorageOrderPricing([cartLine(100, 1)], null);

    expect(out.grossSubtotal).toBe(100);
    expect(out.orderTotal).toBe(90);
  });

  it("fault applies after discount on the payable amount", async () => {
    mockResolveMoreIsLessPercent.mockResolvedValue(10);
    mockIsFaultEnabled.mockImplementation(
      (key: string) => key === "cart_price_miscalculation",
    );
    const out = await computeStorageOrderPricing([cartLine(1000, 1)], {
      appliedCode: "MOREISLESS",
    });

    expect(out.discountAmount).toBe(100);
    expect(out.orderTotal).toBe(Math.floor(900 * 0.9));
  });
});
