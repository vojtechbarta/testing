import { describe, expect, it } from "vitest";
import type { Product } from "./api/products";
import type { Cart } from "./api/cart";
import {
  buildCartExportRows,
  buildProductsExportRows,
  toCsv,
} from "./exportHelpers";

describe("exportHelpers", () => {
  it("buildProductsExportRows maps basic fields", () => {
    const products: Product[] = [
      {
        id: 1,
        name: "P1",
        description: "D1",
        price: { amount: 123.5, currencyCode: "CZK" },
        inStock: 5,
        active: true,
      },
    ];
    const rows = buildProductsExportRows(products);
    expect(rows).toEqual([
      {
        name: "P1",
        description: "D1",
        price: "123.50 CZK",
        inStock: 5,
      },
    ]);
  });

  it("buildCartExportRows maps cart items", () => {
    const cart: Cart = {
      cartSessionId: "abc",
      items: [
        {
          productId: 1,
          name: "P1",
          quantity: 2,
          inStock: 10,
          price: { amount: 10, currencyCode: "EUR" },
          lineTotal: { amount: 20, currencyCode: "EUR" },
        },
      ],
      total: { amount: 20, currencyCode: "EUR" },
    };
    const rows = buildCartExportRows(cart);
    expect(rows).toEqual([
      {
        name: "P1",
        unitPrice: "10.00 EUR",
        quantity: 2,
        lineTotal: "20.00 EUR",
      },
    ]);
  });

  it("toCsv escapes commas, quotes, and newlines", () => {
    const csv = toCsv(
      ["A", "B"],
      [
        ["simple", "value"],
        ['has,comma', 'has "quote"'],
        ["multi\nline", "end"],
      ],
    );
    const lines = csv.split("\n");
    expect(lines[0]).toBe("A,B");
    expect(lines[1]).toBe("simple,value");
    expect(lines[2]).toBe('"has,comma","has ""quote"""');
    expect(lines[3]).toBe('"multi\nline",end');
  });
});

