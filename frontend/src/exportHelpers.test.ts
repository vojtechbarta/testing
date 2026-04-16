import { describe, expect, it } from "vitest";
import type { Product } from "./api/products";
import type { Cart } from "./api/cart";
import {
  buildCartExportRows,
  buildPdfDocument,
  buildProductsExportRows,
  omitMiddleProductForExport,
  sortProductsForExportNameAsc,
  swapCurrencyLabelInMoneyString,
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
    expect(csv).toContain("A,B");
    expect(csv).toContain("simple,value");
    expect(csv).toContain('"has,comma","has ""quote"""');
    expect(csv).toContain('"multi\nline",end');
  });

  it("buildPdfDocument creates a PDF that includes report content", () => {
    const pdf = buildPdfDocument({
      title: "Cart export",
      generatedAt: "2026-04-16 10:30",
      sections: [
        {
          title: "Cart items",
          headers: ["Name", "Quantity"],
          rows: [["Wireless Mouse M200", 2]],
          footerLines: ["Estimated total: 20.00 EUR"],
        },
      ],
    });

    const content = pdf.output();
    expect(content.startsWith("%PDF-")).toBe(true);
    expect(content).toContain("Cart export");
    expect(content).toContain("Wireless Mouse M200");
    expect(content).toContain("Estimated total: 20.00 EUR");
  });

  it("sortProductsForExportNameAsc enforces name A-Z export order", () => {
    const products: Product[] = [
      {
        id: 1,
        name: "Zebra",
        description: "D1",
        price: { amount: 1, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      },
      {
        id: 2,
        name: "Alpha",
        description: "D2",
        price: { amount: 2, currencyCode: "CZK" },
        inStock: 2,
        active: true,
      },
      {
        id: 3,
        name: "Mike",
        description: "D3",
        price: { amount: 3, currencyCode: "CZK" },
        inStock: 3,
        active: true,
      },
    ];

    const sorted = sortProductsForExportNameAsc(products);
    expect(sorted.map((p) => p.name)).toEqual(["Alpha", "Mike", "Zebra"]);
  });

  it("omitMiddleProductForExport removes one item from middle", () => {
    const products: Product[] = [
      {
        id: 1,
        name: "A",
        description: "",
        price: { amount: 1, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      },
      {
        id: 2,
        name: "B",
        description: "",
        price: { amount: 2, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      },
      {
        id: 3,
        name: "C",
        description: "",
        price: { amount: 3, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      },
      {
        id: 4,
        name: "D",
        description: "",
        price: { amount: 4, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      },
      {
        id: 5,
        name: "E",
        description: "",
        price: { amount: 5, currencyCode: "CZK" },
        inStock: 1,
        active: true,
      },
    ];

    const trimmed = omitMiddleProductForExport(products);
    expect(trimmed.map((p) => p.name)).toEqual(["A", "B", "D", "E"]);
  });

  it("swapCurrencyLabelInMoneyString swaps EUR and CZK labels only", () => {
    expect(swapCurrencyLabelInMoneyString("10.00 EUR")).toBe("10.00 CZK");
    expect(swapCurrencyLabelInMoneyString("249.50 CZK")).toBe("249.50 EUR");
    expect(swapCurrencyLabelInMoneyString("99.99 USD")).toBe("99.99 USD");
  });
});

