import { describe, expect, it } from "vitest";
import {
  applySortUiFaultSwap,
  filterProductsByPriceRange,
  getVisibleShopProducts,
  sortShopProducts,
  type ShopCatalogProduct,
} from "./shopCatalog";

const fixtures: ShopCatalogProduct[] = [
  { name: "Gamma", price: { amount: 300 } },
  { name: "Alpha", price: { amount: 100 } },
  { name: "Beta", price: { amount: 200 } },
];

describe("sortShopProducts", () => {
  it("sorts by name ascending (Czech locale)", () => {
    const names = sortShopProducts(fixtures, "name-asc").map((p) => p.name);
    expect(names).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("sorts by name descending", () => {
    const names = sortShopProducts(fixtures, "name-desc").map((p) => p.name);
    expect(names).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("sorts by price ascending", () => {
    const amounts = sortShopProducts(fixtures, "price-asc").map(
      (p) => p.price.amount,
    );
    expect(amounts).toEqual([100, 200, 300]);
  });

  it("sorts by price descending", () => {
    const amounts = sortShopProducts(fixtures, "price-desc").map(
      (p) => p.price.amount,
    );
    expect(amounts).toEqual([300, 200, 100]);
  });
});

describe("filterProductsByPriceRange", () => {
  it("keeps products inside inclusive bounds", () => {
    const out = filterProductsByPriceRange(fixtures, 100, 200);
    expect(out.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });

  it("returns empty when no product matches the range", () => {
    expect(filterProductsByPriceRange(fixtures, 10_000, 20_000)).toEqual([]);
  });

  it("keeps all when range covers every price", () => {
    expect(filterProductsByPriceRange(fixtures, 0, 9999)).toHaveLength(3);
  });
});

describe("applySortUiFaultSwap", () => {
  const sortedNames = ["A", "B", "C", "D"];

  it("swaps last two items for price-asc when sort_price_asc_swap_last_two is active", () => {
    const base = sortedNames.map((name) => ({
      name,
      price: { amount: name.charCodeAt(0) },
    }));
    const out = applySortUiFaultSwap(base, "price-asc", [
      "sort_price_asc_swap_last_two",
    ]);
    expect(out.map((p) => p.name)).toEqual(["A", "B", "D", "C"]);
  });

  it("does not swap when fault key is missing", () => {
    const base = sortedNames.map((name) => ({
      name,
      price: { amount: 1 },
    }));
    const out = applySortUiFaultSwap(base, "price-asc", []);
    expect(out.map((p) => p.name)).toEqual(sortedNames);
  });

  it("swaps last two for name-desc when sort_name_desc_swap_last_two is active", () => {
    const base = sortedNames.map((name) => ({
      name,
      price: { amount: 1 },
    }));
    const out = applySortUiFaultSwap(base, "name-desc", [
      "sort_name_desc_swap_last_two",
    ]);
    expect(out.map((p) => p.name)).toEqual(["A", "B", "D", "C"]);
  });
});

describe("getVisibleShopProducts", () => {
  it("applies filter then sort (price asc)", () => {
    const out = getVisibleShopProducts(
      fixtures,
      { min: 150, max: 250 },
      "price-asc",
      [],
    );
    expect(out.map((p) => p.name)).toEqual(["Beta"]);
  });

  it("applies filter then sort (name asc) with multiple matches", () => {
    const out = getVisibleShopProducts(
      fixtures,
      { min: 0, max: 9999 },
      "name-asc",
      [],
    );
    expect(out.map((p) => p.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});
