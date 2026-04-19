import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPrisma, mockIsFaultEnabled } = vi.hoisted(() => ({
  mockPrisma: {
    product: { findMany: vi.fn() },
    order: { create: vi.fn() },
  },
  mockIsFaultEnabled: vi.fn(),
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("../../faults/faultService", () => ({
  isFaultEnabled: mockIsFaultEnabled,
}));

import { createOrder } from "../orderService";

describe("orderService.createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFaultEnabled.mockReturnValue(false);
  });

  it("throws when requested product is not found", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await expect(createOrder(1, [{ productId: 999, quantity: 1 }])).rejects.toThrow(
      "Product 999 not found",
    );
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it("creates order with 10% miscalculation fault applied", async () => {
    mockIsFaultEnabled.mockImplementation((key) => key === "cart_price_miscalculation");
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        price: 200,
        currencyId: 1,
        currency: { id: 1, code: "CZK" },
      },
    ]);
    mockPrisma.order.create.mockResolvedValue({ id: 1, total: 180, items: [] });

    const result = await createOrder(7, [{ productId: 1, quantity: 1 }]);

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 180,
          subtotalBeforeDiscount: 200,
          discountAmount: 0,
          discountCode: null,
          discountPercent: null,
          userId: 7,
        }),
      }),
    );
    expect(result).toMatchObject({ id: 1, total: 180 });
  });

  it("creates order with standard total when miscalculation fault is disabled", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        price: 200,
        currencyId: 1,
        currency: { id: 1, code: "CZK" },
      },
      {
        id: 2,
        price: 50,
        currencyId: 1,
        currency: { id: 1, code: "CZK" },
      },
    ]);
    mockPrisma.order.create.mockResolvedValue({ id: 2, total: 450, items: [] });

    const result = await createOrder(9, [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 450,
          subtotalBeforeDiscount: 450,
          discountAmount: 0,
          discountCode: null,
          discountPercent: null,
          userId: 9,
        }),
      }),
    );
    expect(result).toMatchObject({ id: 2, total: 450 });
  });

  it("creates a zero-total order when items array is empty", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.order.create.mockResolvedValue({ id: 99, total: 0, items: [] });

    await createOrder(3, []);

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 0,
          subtotalBeforeDiscount: 0,
          currencyId: undefined,
          userId: 3,
        }),
      }),
    );
  });

  it("falls back to nested currency.id when product currencyId is null", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 5,
        price: 120,
        currencyId: null,
        currency: { id: 42, code: "CZK" },
      },
    ]);
    mockPrisma.order.create.mockResolvedValue({ id: 5, total: 120, items: [] });

    await createOrder(10, [{ productId: 5, quantity: 1 }]);

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currencyId: 42,
          items: {
            create: [
              expect.objectContaining({
                productId: 5,
                currencyId: 42,
              }),
            ],
          },
        }),
      }),
    );
  });
});
