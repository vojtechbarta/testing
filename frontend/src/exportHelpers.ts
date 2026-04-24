import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Product } from "./api/products";
import type { Cart } from "./api/cart";

function formatMoney(amount: number, currencyCode: string): string {
  return amount.toFixed(2) + " " + currencyCode;
}

export function buildProductsExportRows(
  products: Product[],
): Array<{ name: string; description: string; category: string; price: string; inStock: number }> {
  return products.map((p) => ({
    name: p.name,
    description: p.description,
    category: p.category,
    price: formatMoney(p.price.amount, p.price.currencyCode),
    inStock: p.inStock,
  }));
}

export function sortProductsForExportNameAsc(products: Product[]): Product[] {
  return [...products].sort((a, b) => a.name.localeCompare(b.name));
}

export function omitMiddleProductForExport(products: Product[]): Product[] {
  if (products.length < 3) {
    return products;
  }
  const middleIndex = Math.floor(products.length / 2);
  return products.filter((_, index) => index !== middleIndex);
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

function swapCurrencyCodeLabel(currencyCode: string): string {
  if (currencyCode === "EUR") return "CZK";
  if (currencyCode === "CZK") return "EUR";
  return currencyCode;
}

export function swapCurrencyLabelInMoneyString(value: string): string {
  return value.replace(/\b(EUR|CZK)\b/g, (code) => swapCurrencyCodeLabel(code));
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

export interface PdfSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  footerLines?: string[];
}

export interface PdfReport {
  title: string;
  generatedAt: string;
  sections: PdfSection[];
}

export function buildPdfDocument(report: PdfReport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;

  const addWrappedText = (
    text: string,
    fontSize: number,
    fontStyle: "normal" | "bold" = "normal",
    spacingAfter = 12,
  ) => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = fontSize + 4;
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + spacingAfter;
  };

  addWrappedText(report.title, 18, "bold", 10);
  addWrappedText(`Generated: ${report.generatedAt}`, 10, "normal", 18);

  for (const section of report.sections) {
    addWrappedText(section.title, 13, "bold", 10);
    autoTable(doc, {
      startY: y,
      head: [section.headers],
      body: section.rows.map((row) => row.map((cell) => String(cell ?? ""))),
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 6,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [20, 20, 20],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      theme: "grid",
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y;
    y += 12;

    for (const footerLine of section.footerLines ?? []) {
      addWrappedText(footerLine, 10, "bold", 8);
    }

    y += 8;
  }

  return doc;
}

export function downloadPdfReport(
  filename: string,
  report: PdfReport,
): void {
  const pdf = buildPdfDocument(report);
  downloadFile(filename, "application/pdf", pdf.output("arraybuffer"));
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

