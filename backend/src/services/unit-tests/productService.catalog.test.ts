import { describe, expect, it } from "vitest";
import { productListingWhere } from "../productService";

describe("productListingWhere (storefront search / filter shape)", () => {
  it("requires active products only when there is no search query", () => {
    expect(productListingWhere(undefined)).toEqual({ active: true });
  });

  it("treats blank and whitespace-only query as no search filter", () => {
    expect(productListingWhere("")).toEqual({ active: true });
    expect(productListingWhere("   \t")).toEqual({ active: true });
  });

  it("trims search query and adds OR on name and description", () => {
    expect(productListingWhere("  usb  ")).toEqual({
      active: true,
      OR: [
        { name: { contains: "usb" } },
        { description: { contains: "usb" } },
      ],
    });
  });

  it("preserves inner spaces in the trimmed query", () => {
    expect(productListingWhere("  noise cancelling  ")).toEqual({
      active: true,
      OR: [
        { name: { contains: "noise cancelling" } },
        { description: { contains: "noise cancelling" } },
      ],
    });
  });

  it("adds Czech translation search branch for cs storefront", () => {
    expect(productListingWhere("mys", "cs")).toEqual({
      active: true,
      OR: [
        { name: { contains: "mys" } },
        { description: { contains: "mys" } },
        {
          translations: {
            some: {
              locale: "cs",
              OR: [
                { name: { contains: "mys" } },
                { description: { contains: "mys" } },
              ],
            },
          },
        },
      ],
    });
  });
});
