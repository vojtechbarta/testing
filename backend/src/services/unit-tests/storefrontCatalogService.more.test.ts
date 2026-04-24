import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPrisma,
  mockIsFaultEnabledRuntime,
  mockIsFaultEnabledStatic,
  mockGetFaultSettings,
  mockLoadEurPerCzkRate,
  mockToStorefrontMoney,
  mockSortStorefrontProducts,
  mockApplySortUiFaultSwap,
  mockStorefrontProductName,
  mockStorefrontProductDescription,
} = vi.hoisted(() => ({
  mockPrisma: {
    product: {
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  },
  mockIsFaultEnabledRuntime: vi.fn(),
  mockIsFaultEnabledStatic: vi.fn(),
  mockGetFaultSettings: vi.fn(),
  mockLoadEurPerCzkRate: vi.fn(),
  mockToStorefrontMoney: vi.fn(),
  mockSortStorefrontProducts: vi.fn(),
  mockApplySortUiFaultSwap: vi.fn(),
  mockStorefrontProductName: vi.fn(),
  mockStorefrontProductDescription: vi.fn(),
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("../../faults/faultRuntime", () => ({
  FAULT_KEYS: {
    apiProductsOddMinuteDelay: "products_api_odd_minute_wait_to_even",
    apiSortPriceAscSwapLastTwo: "sort_price_asc_swap_last_two",
    apiSortNameDescSwapLastTwo: "sort_name_desc_swap_last_two",
  },
  isFaultEnabled: mockIsFaultEnabledRuntime,
}));

vi.mock("../../faults/faultService", () => ({
  isFaultEnabled: mockIsFaultEnabledStatic,
  getFaultSettings: mockGetFaultSettings,
}));

vi.mock("../../shop/storefrontMoney", () => ({
  loadEurPerCzkRate: mockLoadEurPerCzkRate,
  toStorefrontMoney: mockToStorefrontMoney,
}));

vi.mock("../../shop/catalogSortFaults", () => ({
  sortStorefrontProducts: mockSortStorefrontProducts,
  applySortUiFaultSwap: mockApplySortUiFaultSwap,
}));

vi.mock("../../shop/storefrontProductText", () => ({
  storefrontProductName: mockStorefrontProductName,
  storefrontProductDescription: mockStorefrontProductDescription,
}));

import { getStorefrontCatalog, parseStorefrontCatalogQuery } from "../storefrontCatalogService";

describe("storefrontCatalogService additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFaultEnabledRuntime.mockResolvedValue(false);
    mockIsFaultEnabledStatic.mockReturnValue(false);
    mockGetFaultSettings.mockReturnValue(undefined);
    mockLoadEurPerCzkRate.mockResolvedValue(24);
    mockToStorefrontMoney.mockImplementation((amount: number) => ({
      amount,
      currencyCode: "CZK",
    }));
    mockPrisma.category.findMany.mockResolvedValue([{ id: 1, name: "other" }]);
    mockStorefrontProductName.mockImplementation((_id: number, dbName: string) => dbName);
    mockStorefrontProductDescription.mockImplementation((_id: number, dbDesc: string) => dbDesc);
    mockSortStorefrontProducts.mockImplementation((rows: unknown[]) => rows);
    mockApplySortUiFaultSwap.mockImplementation((rows: unknown[]) => rows);
  });

  it("returns empty response with default bounds for no products", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    const out = await getStorefrontCatalog({ lang: "en", sort: "name-asc" });
    expect(out).toEqual({
      products: [],
      categoryOptions: ["other"],
      priceBounds: { min: 0, max: 0, currencyCode: "EUR" },
    });
  });

  it("builds bounds and filters by price range", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: "A",
        description: "d",
        categoryId: 1,
        category: { name: "other" },
        inStock: 1,
        active: true,
        price: 100,
        currency: { code: "CZK" },
      },
      {
        id: 2,
        name: "B",
        description: "d",
        categoryId: 1,
        category: { name: "other" },
        inStock: 1,
        active: true,
        price: 300,
        currency: { code: "CZK" },
      },
    ]);

    const out = await getStorefrontCatalog({
      lang: "cs",
      sort: "price-asc",
      priceMin: 110,
      priceMax: 350,
      searchQuery: "x",
    });

    expect(out.priceBounds).toEqual({ min: 100, max: 300, currencyCode: "CZK" });
    expect(out.products).toHaveLength(1);
    expect(mockSortStorefrontProducts).toHaveBeenCalled();
    expect(mockApplySortUiFaultSwap).toHaveBeenCalled();
  });

  it("reads static latency fault settings and normalizes reversed price bounds", async () => {
    mockIsFaultEnabledStatic.mockReturnValue(true);
    mockGetFaultSettings.mockReturnValue({ latencyMs: 0 });
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: "A",
        description: "d",
        categoryId: 1,
        category: { name: "other" },
        inStock: 1,
        active: true,
        price: 100,
        currency: { code: "CZK" },
      },
      {
        id: 2,
        name: "B",
        description: "d",
        categoryId: 1,
        category: { name: "other" },
        inStock: 1,
        active: true,
        price: 300,
        currency: { code: "CZK" },
      },
    ]);

    const out = await getStorefrontCatalog({
      lang: "cs",
      sort: "name-asc",
      priceMin: 400,
      priceMax: 50,
    });

    expect(mockGetFaultSettings).toHaveBeenCalledWith("productListing_latency");
    expect(out.products).toHaveLength(2);
  });

  it("parseStorefrontCatalogQuery normalizes invalid values", () => {
    const parsed = parseStorefrontCatalogQuery({
      query: {
        q: "  hello ",
        lang: "cs",
        sort: "name-desc",
        priceMin: "bad",
        priceMax: "900",
      },
    });
    expect(parsed).toEqual({
      q: "hello",
      lang: "cs",
      sort: "name-desc",
      priceMax: 900,
    });
  });

  it("parseStorefrontCatalogQuery parses category selectors", () => {
    const parsed = parseStorefrontCatalogQuery({
      query: {
        category: " audio ",
        categories: "audio,office",
      },
    });
    expect(parsed).toEqual({
      lang: "en",
      sort: "name-asc",
      category: "audio",
      categories: ["audio", "office"],
    });
  });

  it("adds runtime sort fault keys and calls swap for matching sorts", async () => {
    mockIsFaultEnabledRuntime
      .mockResolvedValueOnce(false) // odd-minute delay
      .mockResolvedValueOnce(true) // price asc swap
      .mockResolvedValueOnce(false); // name desc swap
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: "A",
        description: "d",
        categoryId: 1,
        category: { name: "other" },
        inStock: 1,
        active: true,
        price: 100,
        currency: { code: "CZK" },
      },
      {
        id: 2,
        name: "B",
        description: "d",
        categoryId: 1,
        category: { name: "other" },
        inStock: 1,
        active: true,
        price: 200,
        currency: { code: "CZK" },
      },
    ]);

    await getStorefrontCatalog({ lang: "en", sort: "price-asc" });

    expect(mockApplySortUiFaultSwap).toHaveBeenCalledWith(
      expect.any(Array),
      "price-asc",
      expect.any(Set),
    );
    const faultSet = mockApplySortUiFaultSwap.mock.calls[0]?.[2] as Set<string>;
    expect(faultSet.has("sort_price_asc_swap_last_two")).toBe(true);
  });
});
