import { describe, expect, it } from "vitest";
import type { ProductDto } from "../services/productService";
import { applySortUiFaultSwap, sortStorefrontProducts } from "./catalogSortFaults";

function p(
  id: number,
  name: string,
  amount: number,
): ProductDto {
  return {
    id,
    name,
    description: "",
    inStock: 1,
    active: true,
    price: { amount, currencyCode: "CZK" },
  };
}

const fixtures: ProductDto[] = [
  p(1, "Gamma", 300),
  p(2, "Alpha", 100),
  p(3, "Beta", 200),
];

describe("sortStorefrontProducts", () => {
  it("sorts by name ascending (English locale when lang en)", () => {
    const names = sortStorefrontProducts(fixtures, "name-asc", "en").map(
      (x) => x.name,
    );
    expect(names).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("sorts by price ascending", () => {
    const amounts = sortStorefrontProducts(fixtures, "price-asc", "en").map(
      (x) => x.price.amount,
    );
    expect(amounts).toEqual([100, 200, 300]);
  });
});

describe("applySortUiFaultSwap", () => {
  it("swaps last two for price-asc when fault key present", () => {
    const base = ["A", "B", "C", "D"].map((name, i) =>
      p(i + 1, name, name.charCodeAt(0)),
    );
    const out = applySortUiFaultSwap(base, "price-asc", new Set(["sort_price_asc_swap_last_two"]));
    expect(out.map((x) => x.name)).toEqual(["A", "B", "D", "C"]);
  });
});
