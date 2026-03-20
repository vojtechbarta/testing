import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockShouldTriggerFault } = vi.hoisted(() => ({
  mockPrisma: {
    cartItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
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

import { addOrUpdateCartItem, getCart } from "../cartService";

const TEST_CART_KEY = "aaaaaaaa-bbbb-4ccc-bddd-111111111111";

describe("cartService", () => {
  // Default: unit-level fault does not fire (disabled / non-triggered behaviour).
  beforeEach(() => {
    mockShouldTriggerFault.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Verifies getCart maps DB rows to the cart DTO (price, currency, line subtotals, cart total).
  it("calculates cart totals and maps money fields", async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 10,
        quantity: 2,
        product: {
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
          name: "Mouse",
          price: 300,
          inStock: 5,
          currency: { code: "CZK" },
        },
      },
    ]);

    const cart = await getCart(TEST_CART_KEY);

    expect(cart.cartSessionId).toBe(TEST_CART_KEY);
    expect(cart.total.amount).toBe(1300);
    expect(cart.total.currencyCode).toBe("CZK");
    expect(cart.items[0]?.lineTotal.amount).toBe(1000);
    expect(cart.items[1]?.price.amount).toBe(300);
  });

  // Verifies quantity <= 0 removes the cart line via deleteMany (no positive-quantity update/create).
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

  // Verifies a missing (or inactive) product throws a clear error instead of failing silently.
  it("throws when product is missing or inactive", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      addOrUpdateCartItem(TEST_CART_KEY, 999, 1),
    ).rejects.toThrow("Product is not available.");
  });

  // Verifies an existing line is updated to the exact requested quantity when the unit fault does not apply.
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

  // Verifies when shouldTriggerFault is true, only the delta vs current cart quantity is doubled (unit/DB mutation).
  it("applies unit fault by doubling quantity delta", async () => {
    mockShouldTriggerFault.mockResolvedValue(true);
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      active: true,
      inStock: 20,
      currencyId: 1,
    });
    // Existing quantity 2, target quantity 3 => delta 1, mutated target 4.
    mockPrisma.cartItem.findFirst.mockResolvedValue({ id: 123, quantity: 2 });
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    await addOrUpdateCartItem(TEST_CART_KEY, 10, 3);

    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 123 },
      data: { quantity: 4, currencyId: 1 },
    });
  });

  // Verifies quantity after all logic (including optional mutation) cannot exceed stock; otherwise throws with limit.
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
});
