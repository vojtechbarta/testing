import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveMoreIsLessFinalPercent = vi.fn();

vi.mock("../../shop/discountMoreIsLess", () => ({
  PROMO_CODE_MORE_IS_LESS: "MOREISLESS",
  normalizePromotionCode: (s: string | null | undefined) =>
    String(s ?? "").trim().toUpperCase(),
  canonicalPromotionCode: (s: string) =>
    s === "MOREISLESS" ? "MOREISLESS" : null,
  resolveMoreIsLessFinalPercent: (...args: unknown[]) =>
    mockResolveMoreIsLessFinalPercent(...args),
}));

const { mockPrisma, mockShouldTriggerFault } = vi.hoisted(() => ({
  mockPrisma: {
    cartItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    cartPromotion: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    exchangeRate: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
  mockShouldTriggerFault: vi.fn(),
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("../../faults/faultRuntime", () => ({
  FAULT_KEYS: {
    unitCartAddDoubleQuantityPersist: "cart_add_unit_double_quantity_persist",
  },
  shouldTriggerFault: mockShouldTriggerFault,
}));

import { addOrUpdateCartItem, applyCartPromotion, clearCart, getCart } from "../cartService";

const TEST_CART_KEY = "aaaaaaaa-bbbb-4ccc-bddd-111111111111";

describe("cartService", () => {
  beforeEach(() => {
    mockShouldTriggerFault.mockResolvedValue(false);
    mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
    mockPrisma.cartPromotion.findUnique.mockResolvedValue(null);
    mockResolveMoreIsLessFinalPercent.mockResolvedValue(10);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calculates cart totals and maps money fields", async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 10,
        quantity: 2,
        product: {
          id: 10,
          name: "Keyboard",
          price: 500,
          inStock: 10,
          currency: { code: "CZK" },
        },
      },
      {
        productId: 11,
        quantity: 1,
        product: {
          id: 11,
          name: "Mouse",
          price: 300,
          inStock: 5,
          currency: { code: "CZK" },
        },
      },
    ]);

    const cart = await getCart(TEST_CART_KEY);

    expect(cart.cartSessionId).toBe(TEST_CART_KEY);
    expect(cart.subtotal.amount).toBe(1300);
    expect(cart.discount).toBeNull();
    expect(cart.total.amount).toBe(1300);
    expect(cart.total.currencyCode).toBe("CZK");
    expect(cart.items[0]?.lineTotal.amount).toBe(1000);
    expect(cart.items[1]?.price.amount).toBe(300);
  });

  it("applyCartPromotion accepts case-insensitive code and upserts storage", async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 10,
        quantity: 1,
        product: {
          id: 10,
          name: "Keyboard",
          price: 1000,
          inStock: 10,
          currency: { code: "CZK" },
        },
      },
    ]);
    mockPrisma.cartPromotion.upsert.mockResolvedValue({});
    mockPrisma.cartPromotion.findUnique.mockResolvedValue({
      cartKey: TEST_CART_KEY,
      appliedCode: "MOREISLESS",
    });

    const cart = await applyCartPromotion(TEST_CART_KEY, "  moreisless  ");

    expect(mockPrisma.cartPromotion.upsert).toHaveBeenCalledWith({
      where: { cartKey: TEST_CART_KEY },
      create: { cartKey: TEST_CART_KEY, appliedCode: "MOREISLESS" },
      update: { appliedCode: "MOREISLESS" },
    });
    expect(cart.discount).toMatchObject({ code: "MOREISLESS" });
  });

  it("applyCartPromotion with empty code clears promotion and returns cart", async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([]);
    mockPrisma.cartPromotion.deleteMany.mockResolvedValue({ count: 0 });

    const cart = await applyCartPromotion(TEST_CART_KEY, "   ");

    expect(mockPrisma.cartPromotion.deleteMany).toHaveBeenCalledWith({
      where: { cartKey: TEST_CART_KEY },
    });
    expect(cart.items).toEqual([]);
    expect(cart.discount).toBeNull();
  });

  it("applyCartPromotion throws for unknown code and does not upsert", async () => {
    await expect(
      applyCartPromotion(TEST_CART_KEY, "UNKNOWN"),
    ).rejects.toThrow("Unknown promotion code.");
    expect(mockPrisma.cartPromotion.upsert).not.toHaveBeenCalled();
  });

  it("getCart drops non-canonical stored code and deletes the row", async () => {
    mockPrisma.cartPromotion.findUnique.mockResolvedValue({
      cartKey: TEST_CART_KEY,
      appliedCode: "EXPIRED",
    });
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 10,
        quantity: 1,
        product: {
          id: 10,
          name: "Keyboard",
          price: 1000,
          inStock: 10,
          currency: { code: "CZK" },
        },
      },
    ]);
    mockPrisma.cartPromotion.delete.mockResolvedValue({});

    const cart = await getCart(TEST_CART_KEY);

    expect(mockPrisma.cartPromotion.delete).toHaveBeenCalledWith({
      where: { cartKey: TEST_CART_KEY },
    });
    expect(cart.discount).toBeNull();
    expect(cart.total.amount).toBe(1000);
  });

  it("getCart clears promotion from DB when cart is empty", async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([]);
    mockPrisma.cartPromotion.findUnique.mockResolvedValue({
      cartKey: TEST_CART_KEY,
      appliedCode: "MOREISLESS",
    });
    mockPrisma.cartPromotion.deleteMany.mockResolvedValue({ count: 1 });

    const cart = await getCart(TEST_CART_KEY);

    expect(mockPrisma.cartPromotion.deleteMany).toHaveBeenCalledWith({
      where: { cartKey: TEST_CART_KEY },
    });
    expect(cart.items).toEqual([]);
    expect(cart.discount).toBeNull();
  });

  it("applies MoreIsLess discount when promotion row is present", async () => {
    mockPrisma.cartPromotion.findUnique.mockResolvedValue({
      cartKey: TEST_CART_KEY,
      appliedCode: "MOREISLESS",
    });
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 10,
        quantity: 2,
        product: {
          id: 10,
          name: "Keyboard",
          price: 500,
          inStock: 10,
          currency: { code: "CZK" },
        },
      },
    ]);

    const cart = await getCart(TEST_CART_KEY);

    expect(mockResolveMoreIsLessFinalPercent).toHaveBeenCalled();
    expect(cart.subtotal.amount).toBe(1000);
    expect(cart.discount).toMatchObject({
      code: "MOREISLESS",
      percent: 10,
      amount: 100,
      currencyCode: "CZK",
    });
    expect(cart.total.amount).toBe(900);
  });

  it("deletes item when quantity is zero", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 10,
      currencyId: 1,
    });
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    await addOrUpdateCartItem(TEST_CART_KEY, 10, 0);

    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartKey: TEST_CART_KEY, productId: 10 },
    });
  });

  it("throws when product is missing or inactive", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      addOrUpdateCartItem(TEST_CART_KEY, 999, 1),
    ).rejects.toThrow("Product is not available.");
  });

  it("throws when product exists but is inactive", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 999,
      active: false,
      inStock: 10,
      currencyId: 1,
    });

    await expect(addOrUpdateCartItem(TEST_CART_KEY, 999, 1)).rejects.toThrow(
      "Product is not available.",
    );
  });

  it("updates existing cart item without fault mutation", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 20,
      currencyId: 1,
    });
    mockPrisma.cartItem.findFirst.mockResolvedValue({ id: 123, quantity: 1 });
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    await addOrUpdateCartItem(TEST_CART_KEY, 10, 3);

    expect(mockShouldTriggerFault).toHaveBeenCalled();
    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 123 },
      data: { quantity: 3, currencyId: 1 },
    });
  });

  it("applies unit fault by doubling quantity delta", async () => {
    mockShouldTriggerFault.mockResolvedValue(true);
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 20,
      currencyId: 1,
    });
    mockPrisma.cartItem.findFirst.mockResolvedValue({ id: 123, quantity: 2 });
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    await addOrUpdateCartItem(TEST_CART_KEY, 10, 3);

    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 123 },
      data: { quantity: 4, currencyId: 1 },
    });
  });

  it("throws when requested quantity exceeds stock", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 2,
      currencyId: 1,
    });
    mockPrisma.cartItem.findFirst.mockResolvedValue(null);

    await expect(addOrUpdateCartItem(TEST_CART_KEY, 10, 5)).rejects.toThrow(
      "Cannot add more than 2 items in stock.",
    );
  });

  it("creates new cart line when no existing row exists", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 10,
      currencyId: 1,
    });
    mockPrisma.cartItem.findFirst.mockResolvedValue(null);
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    await addOrUpdateCartItem(TEST_CART_KEY, 10, 2);

    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartKey: TEST_CART_KEY,
        productId: 10,
        quantity: 2,
        currencyId: 1,
      },
    });
  });

  it("stores undefined currencyId when product currency is missing", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 10,
      currencyId: null,
    });
    mockPrisma.cartItem.findFirst.mockResolvedValue(null);
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    await addOrUpdateCartItem(TEST_CART_KEY, 10, 2);

    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currencyId: undefined,
      }),
    });
  });

  it("does not evaluate fault when requested quantity is not an increase", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 20,
      currencyId: 1,
    });
    mockPrisma.cartItem.findFirst.mockResolvedValue({ id: 123, quantity: 3 });
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    await addOrUpdateCartItem(TEST_CART_KEY, 10, 3);

    expect(mockShouldTriggerFault).not.toHaveBeenCalled();
    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 123 },
      data: { quantity: 3, currencyId: 1 },
    });
  });

  it("clearCart removes cart lines and promotions for the session", async () => {
    await clearCart(TEST_CART_KEY);
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartKey: TEST_CART_KEY },
    });
    expect(mockPrisma.cartPromotion.deleteMany).toHaveBeenCalledWith({
      where: { cartKey: TEST_CART_KEY },
    });
  });

  it("getCart falls back to CZK total when cart is empty", async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    const cart = await getCart(TEST_CART_KEY);

    expect(cart.total).toEqual({ amount: 0, currencyCode: "CZK" });
    expect(cart.subtotal).toEqual({ amount: 0, currencyCode: "CZK" });
    expect(cart.discount).toBeNull();
  });

  it("applies MoreIsLess discount with EUR rounding on subtotal", async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue({ exchangeRate: 24 });
    mockPrisma.cartPromotion.findUnique.mockResolvedValue({
      cartKey: TEST_CART_KEY,
      appliedCode: "MOREISLESS",
    });
    mockResolveMoreIsLessFinalPercent.mockResolvedValue(10);
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 10,
        quantity: 3,
        product: {
          id: 10,
          name: "Keyboard",
          price: 17,
          inStock: 10,
          currency: { code: "EUR" },
        },
      },
    ]);

    const cart = await getCart(TEST_CART_KEY, "en");

    expect(cart.subtotal.amount).toBe(51);
    expect(cart.discount).toMatchObject({
      code: "MOREISLESS",
      percent: 10,
      currencyCode: "EUR",
      amount: 5.1,
    });
    expect(cart.total.amount).toBe(45.9);
  });

  it("getCart keeps EUR decimals for totals", async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue({ exchangeRate: 24 });
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 10,
        quantity: 3,
        product: {
          id: 10,
          name: "Keyboard",
          price: 17,
          inStock: 10,
          currency: { code: "EUR" },
        },
      },
    ]);

    const cart = await getCart(TEST_CART_KEY, "en");

    expect(cart.total.currencyCode).toBe("EUR");
    expect(cart.subtotal.amount).toBe(51);
    expect(cart.total.amount).toBe(51);
    expect(cart.discount).toBeNull();
  });

  it("getCart defaults missing product currency to CZK", async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 33,
        quantity: 1,
        product: {
          id: 33,
          name: "No Currency Product",
          price: 1499,
          inStock: 5,
          currency: null,
        },
      },
    ]);

    const cart = await getCart(TEST_CART_KEY, "cs");

    expect(cart.total).toEqual({ amount: 1499, currencyCode: "CZK" });
    expect(cart.subtotal).toEqual({ amount: 1499, currencyCode: "CZK" });
    expect(cart.items[0]?.price.currencyCode).toBe("CZK");
  });
});
