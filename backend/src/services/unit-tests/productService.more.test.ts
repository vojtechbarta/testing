import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockIsFaultEnabled, mockGetFaultSettings } = vi.hoisted(() => ({
  mockPrisma: {
    product: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    currency: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    cartItem: {
      deleteMany: vi.fn(),
    },
    orderItem: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockIsFaultEnabled: vi.fn(),
  mockGetFaultSettings: vi.fn(),
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("../../faults/faultService", () => ({
  isFaultEnabled: mockIsFaultEnabled,
  getFaultSettings: mockGetFaultSettings,
}));

import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getAllProductsForAdmin,
  mapProductToDto,
  updateProduct,
} from "../productService";

describe("productService additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFaultEnabled.mockReturnValue(false);
    mockGetFaultSettings.mockReturnValue(undefined);
  });

  it("mapProductToDto defaults currency to EUR when missing", () => {
    const dto = mapProductToDto({
      id: 1,
      name: "N",
      description: "D",
      inStock: 3,
      active: true,
      price: 42,
      currency: null,
    });
    expect(dto.price.currencyCode).toBe("EUR");
  });

  it("getAllProducts maps rows and respects search query filter", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 2,
        name: "Wireless",
        description: "Mouse",
        inStock: 4,
        active: true,
        price: 20,
        currency: { code: "CZK" },
      },
    ]);

    const rows = await getAllProducts("Mouse");

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Wireless");
  });

  it("getAllProducts reads latency settings when productListing fault is enabled", async () => {
    mockIsFaultEnabled.mockReturnValue(true);
    mockGetFaultSettings.mockReturnValue({ latencyMs: 0 });
    mockPrisma.product.findMany.mockResolvedValue([]);

    await getAllProducts();

    expect(mockGetFaultSettings).toHaveBeenCalledWith("productListing_latency");
  });

  it("getAllProductsForAdmin returns id-sorted mapped rows", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: "A",
        description: "B",
        inStock: 1,
        active: true,
        price: 100,
        currency: { code: "CZK" },
      },
    ]);
    const rows = await getAllProductsForAdmin();
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
      orderBy: { id: "asc" },
      include: { currency: true },
    });
    expect(rows[0]?.id).toBe(1);
  });

  it("createProduct creates missing currency then persists rounded price", async () => {
    mockPrisma.currency.findUnique.mockResolvedValue(null);
    mockPrisma.currency.create.mockResolvedValue({ id: 5, code: "EUR" });
    mockPrisma.product.create.mockResolvedValue({
      id: 9,
      name: "Prod",
      description: "Desc",
      inStock: 2,
      active: true,
      price: 11,
      currency: { code: "EUR" },
    });

    const row = await createProduct({
      name: "Prod",
      description: "Desc",
      inStock: 2,
      active: true,
      price: { amount: 10.6, currencyCode: "EUR" },
    });

    expect(mockPrisma.currency.create).toHaveBeenCalledWith({ data: { code: "EUR" } });
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ price: 11, currencyId: 5 }),
      }),
    );
    expect(row.price.currencyCode).toBe("EUR");
  });

  it("updateProduct uses existing currency and rounds amount", async () => {
    mockPrisma.currency.findUnique.mockResolvedValue({ id: 1, code: "CZK" });
    mockPrisma.product.update.mockResolvedValue({
      id: 3,
      name: "Updated",
      description: "d",
      inStock: 8,
      active: false,
      price: 16,
      currency: { code: "CZK" },
    });

    const row = await updateProduct(3, {
      name: "Updated",
      description: "d",
      inStock: 8,
      active: false,
      price: { amount: 15.9, currencyCode: "CZK" },
    });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({ price: 16, currencyId: 1 }),
      }),
    );
    expect(row.id).toBe(3);
  });

  it("createProduct uses default EUR currency when code is omitted", async () => {
    mockPrisma.currency.findUnique.mockResolvedValue({ id: 2, code: "EUR" });
    mockPrisma.product.create.mockResolvedValue({
      id: 10,
      name: "NoCode",
      description: "desc",
      inStock: 1,
      active: true,
      price: 5,
      currency: { code: "EUR" },
    });

    const row = await createProduct({
      name: "NoCode",
      description: "desc",
      inStock: 1,
      active: true,
      price: { amount: 5.2, currencyCode: undefined as unknown as string },
    });

    expect(mockPrisma.currency.findUnique).toHaveBeenCalledWith({ where: { code: "EUR" } });
    expect(row.price.currencyCode).toBe("EUR");
  });

  it("deleteProduct removes references and product in transaction", async () => {
    const t1 = { kind: "cart" };
    const t2 = { kind: "order" };
    const t3 = { kind: "product" };
    mockPrisma.cartItem.deleteMany.mockReturnValue(t1);
    mockPrisma.orderItem.deleteMany.mockReturnValue(t2);
    mockPrisma.product.delete.mockReturnValue(t3);
    mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

    await deleteProduct(77);

    expect(mockPrisma.$transaction).toHaveBeenCalledWith([t1, t2, t3]);
  });
});
