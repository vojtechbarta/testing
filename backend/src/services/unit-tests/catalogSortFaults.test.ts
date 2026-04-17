import { describe, expect, it } from "vitest";
import { applySortUiFaultSwap, sortStorefrontProducts } from "../../shop/catalogSortFaults";

const PRODUCTS = [
  { id: 1, name: "B", description: "", inStock: 1, active: true, price: { amount: 30, currencyCode: "CZK" } },
  { id: 2, name: "A", description: "", inStock: 1, active: true, price: { amount: 10, currencyCode: "CZK" } },
  { id: 3, name: "C", description: "", inStock: 1, active: true, price: { amount: 20, currencyCode: "CZK" } },
];

describe("catalogSortFaults", () => {
  it("sorts by name ascending", () => {
    const sorted = sortStorefrontProducts(PRODUCTS, "name-asc", "en");
    expect(sorted.map((p) => p.name)).toEqual(["A", "B", "C"]);
  });

  it("sorts by price descending", () => {
    const sorted = sortStorefrontProducts(PRODUCTS, "price-desc", "en");
    expect(sorted.map((p) => p.price.amount)).toEqual([30, 20, 10]);
  });

  it("swaps last two for price-asc fault key", () => {
    const sorted = sortStorefrontProducts(PRODUCTS, "price-asc", "en");
    const out = applySortUiFaultSwap(
      sorted,
      "price-asc",
      new Set(["sort_price_asc_swap_last_two"]),
    );
    expect(out.map((p) => p.id)).toEqual([2, 1, 3]);
  });

  it("keeps list unchanged when fault key is not active", () => {
    const sorted = sortStorefrontProducts(PRODUCTS, "name-desc", "en");
    const out = applySortUiFaultSwap(sorted, "name-desc", new Set());
    expect(out).toEqual(sorted);
  });
});
