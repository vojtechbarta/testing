import type { Product } from "./api/products";
import type { Cart } from "./api/cart";

function formatMoney(amount: number, currencyCode: string): string {
  return amount.toFixed(2) + " " + currencyCode;
}

export function buildProductsExportRows(
  products: Product[],
): Array<{ name: string; description: string; price: string; inStock: number }> {
  return products.map((p) => ({
    name: p.name,
    description: p.description,
    price: formatMoney(p.price.amount, p.price.currencyCode),
    inStock: p.inStock,
  }));
}

export function buildCartExportRows(cart: Cart | null): Array<{
  name: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}> {
  if (!cart) return [];
  return cart.items.map((item) => ({
    name: item.name,
    unitPrice: formatMoney(item.price.amount, item.price.currencyCode),
    quantity: item.quantity,
    lineTotal: formatMoney(
      item.lineTotal.amount,
      item.lineTotal.currencyCode,
    ),
  }));
}

export function toCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const escapeCell = (value: string | number): string => {
    const s = String(value);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  return lines.join("\n");
}

export function downloadFile(
  filename: string,
  mimeType: string,
  data: BlobPart | string,
): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

