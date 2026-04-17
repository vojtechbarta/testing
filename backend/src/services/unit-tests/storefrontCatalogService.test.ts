import { describe, expect, it } from "vitest";
import { parseStorefrontCatalogQuery } from "../storefrontCatalogService";

describe("storefrontCatalogService.parseStorefrontCatalogQuery", () => {
  it("trims search text and preserves valid sort/lang/price bounds", () => {
    const parsed = parseStorefrontCatalogQuery({
      query: {
        q: "  Mouse  ",
        lang: "cs",
        sort: "price-desc",
        priceMin: "100",
        priceMax: "300",
      },
    });

    expect(parsed).toEqual({
      q: "Mouse",
      lang: "cs",
      sort: "price-desc",
      priceMin: 100,
      priceMax: 300,
    });
  });

  it("falls back to defaults for invalid inputs", () => {
    const parsed = parseStorefrontCatalogQuery({
      query: {
        q: "   ",
        lang: "de",
        sort: "unknown-sort",
        priceMin: "not-number",
        priceMax: "",
      },
    });

    expect(parsed).toEqual({
      lang: "en",
      sort: "name-asc",
    });
  });
});
