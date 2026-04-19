import nodemailer from "nodemailer";
import type { SentMessageInfo } from "nodemailer";
import type { Order, OrderItem, Product, Currency } from "@prisma/client";

type OrderWithLines = Order & {
  items: (OrderItem & { product: Product })[];
  currency: Currency | null;
};

export type BankTransferMailInfo = {
  beneficiary: string;
  iban: string;
  bic: string;
  bankName: string;
  variableSymbol: string;
  specificSymbol: string;
  constantSymbol: string;
  amount: { value: number; currencyCode: string };
  note: string;
};

export type MailLang = "en" | "cs";

export type SendBankTransferMailResult =
  | { sent: true; previewUrl?: string }
  | { sent: false; error: string };

/** Use Ethereal (https://ethereal.email) — fake SMTP with web preview of messages. */
export function isEtherealMode(): boolean {
  const v =
    process.env.SMTP_USE_ETHEREAL?.trim() ??
    process.env.USE_ETHEREAL_EMAIL?.trim();
  return v === "true" || v === "1" || v?.toLowerCase() === "yes";
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure =
    process.env.SMTP_SECURE === "true" || String(port) === "465";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !from) {
    return null;
  }

  return { host, port, secure, from, user, pass };
}

/** True if bank-transfer confirmation email will be attempted (real SMTP or Ethereal). */
export function isSmtpConfigured(): boolean {
  if (isEtherealMode()) {
    return true;
  }
  return getSmtpConfig() !== null;
}

let etherealAccountPromise: Promise<{ user: string; pass: string }> | null =
  null;

function getEtherealAccount(): Promise<{ user: string; pass: string }> {
  if (!etherealAccountPromise) {
    etherealAccountPromise = nodemailer.createTestAccount().then((account) => {
      // eslint-disable-next-line no-console
      console.log(
        "[Ethereal] Test account created — user:",
        account.user,
        "(in-memory until server restart; no .env needed)",
      );
      return { user: account.user, pass: account.pass };
    });
  }
  return etherealAccountPromise;
}

async function createTransporterAndFrom(): Promise<{
  send: (mail: nodemailer.SendMailOptions) => Promise<SentMessageInfo>;
  from: string;
  isEthereal: boolean;
} | null> {
  if (isEtherealMode()) {
    const auth = await getEtherealAccount();
    const from =
      process.env.SMTP_FROM?.trim() || `AI Testing Shop <${auth.user}>`;
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth,
    });
    return {
      send: (mail) => transporter.sendMail(mail),
      from,
      isEthereal: true,
    };
  }

  const cfg = getSmtpConfig();
  if (!cfg) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.user && cfg.pass
      ? { auth: { user: cfg.user, pass: cfg.pass } }
      : {}),
  });

  return {
    send: (mail) => transporter.sendMail(mail),
    from: cfg.from,
    isEthereal: false,
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number, code: string, lang: MailLang) {
  try {
    return new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

function buildOrderSummaryHtml(
  order: OrderWithLines,
  bank: BankTransferMailInfo,
  lang: MailLang,
) {
  const i18n =
    lang === "cs"
      ? {
          title: "Potvrzení objednávky · AI Testing Shop (demo)",
          intro:
            "Děkujeme za objednávku. Toto je testovací storefront; níže uvedené bankovní údaje jsou pouze dummy, pokud je operátor nenahradil.",
          orderNumber: "Objednávka",
          item: "Položka",
          qty: "Množství",
          unit: "Jednotka",
          line: "Řádek",
          subtotal: "Mezisoučet",
          discount: "Sleva",
          total: "Celkem",
          bankSection: "Bankovní převod (dummy)",
          beneficiary: "Příjemce",
          bank: "Banka",
          variableSymbol: "Variabilní symbol",
          amount: "Částka",
          footer:
            "Tato zpráva obsahuje HTML + plain text. Reálný obchod by zde mohl přiložit PDF fakturu.",
        }
      : {
          title: "Order confirmation · AI Testing Shop (demo)",
          intro:
            "Thank you for your order. This is a test storefront; bank details below are dummy unless your operator replaced them.",
          orderNumber: "Order",
          item: "Item",
          qty: "Qty",
          unit: "Unit",
          line: "Line",
          subtotal: "Subtotal",
          discount: "Discount",
          total: "Total",
          bankSection: "Bank transfer (dummy)",
          beneficiary: "Beneficiary",
          bank: "Bank",
          variableSymbol: "Variable symbol",
          amount: "Amount",
          footer:
            "This message is HTML + plain text only. A real shop might attach a PDF invoice here.",
        };
  const currencyCode = order.currency?.code ?? "CZK";
  const lines = order.items
    .map(
      (i) => {
        const lineTotal = i.unitPrice * i.quantity;
        return `<tr><td>${escapeHtml(i.product.name)}</td><td style="text-align:right">${i.quantity}×</td><td style="text-align:right">${formatMoney(i.unitPrice, currencyCode, lang)}</td><td style="text-align:right">${formatMoney(lineTotal, currencyCode, lang)}</td></tr>`;
      },
    )
    .join("");

  const showBreakdown =
    order.discountCode != null || order.discountAmount > 0;

  let tfootHtml: string;
  if (!showBreakdown) {
    tfootHtml = `<tr><th colspan="3" style="text-align:right">${i18n.total}</th><th style="text-align:right">${formatMoney(order.total, currencyCode, lang)}</th></tr>`;
  } else {
    const subtotalRow = `<tr><th colspan="3" style="text-align:right">${i18n.subtotal}</th><th style="text-align:right">${formatMoney(order.subtotalBeforeDiscount, currencyCode, lang)}</th></tr>`;
    const pct =
      order.discountPercent != null && order.discountPercent > 0
        ? ` −${order.discountPercent}%`
        : "";
    const codePart = order.discountCode
      ? ` (${escapeHtml(order.discountCode)})`
      : "";
    const discountRow = `<tr><th colspan="3" style="text-align:right">${i18n.discount}${pct}${codePart}</th><th style="text-align:right">−${formatMoney(order.discountAmount, currencyCode, lang)}</th></tr>`;
    const totalRow = `<tr><th colspan="3" style="text-align:right">${i18n.total}</th><th style="text-align:right">${formatMoney(order.total, currencyCode, lang)}</th></tr>`;
    tfootHtml = `${subtotalRow}${discountRow}${totalRow}`;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${i18n.orderNumber} #${order.id}</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h1>${i18n.title}</h1>
  <p>${escapeHtml(i18n.intro)}</p>
  <p><strong>${i18n.orderNumber} #${order.id}</strong></p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">
    <thead><tr><th>${i18n.item}</th><th style="text-align:right">${i18n.qty}</th><th style="text-align:right">${i18n.unit}</th><th style="text-align:right">${i18n.line}</th></tr></thead>
    <tbody>${lines}</tbody>
    <tfoot>${tfootHtml}</tfoot>
  </table>
  <h2>${i18n.bankSection}</h2>
  <p style="color:#b45309"><strong>${escapeHtml(bank.note)}</strong></p>
  <table style="max-width:480px">
    <tr><td>${i18n.beneficiary}</td><td>${escapeHtml(bank.beneficiary)}</td></tr>
    <tr><td>IBAN</td><td><code>${escapeHtml(bank.iban)}</code></td></tr>
    <tr><td>BIC</td><td><code>${escapeHtml(bank.bic)}</code></td></tr>
    <tr><td>${i18n.bank}</td><td>${escapeHtml(bank.bankName)}</td></tr>
    <tr><td>${i18n.variableSymbol}</td><td><code>${escapeHtml(bank.variableSymbol)}</code></td></tr>
    <tr><td>${i18n.amount}</td><td><strong>${formatMoney(bank.amount.value, bank.amount.currencyCode, lang)}</strong></td></tr>
  </table>
  <p style="margin-top:2rem;font-size:12px;color:#666">${escapeHtml(i18n.footer)}</p>
</body>
</html>`.trim();
}

function buildOrderSummaryText(
  order: OrderWithLines,
  bank: BankTransferMailInfo,
  lang: MailLang,
) {
  const i18n =
    lang === "cs"
      ? {
          title: "Objednávka",
          subtotal: "Mezisoučet",
          discount: "Sleva",
          total: "Celkem",
          bankTransfer: "Bankovní převod (dummy)",
          variableSymbol: "Variabilní symbol",
          amount: "Částka",
        }
      : {
          title: "Order",
          subtotal: "Subtotal",
          discount: "Discount",
          total: "Total",
          bankTransfer: "Bank transfer (dummy)",
          variableSymbol: "Variable symbol",
          amount: "Amount",
        };
  const currencyCode = order.currency?.code ?? "CZK";
  const lines = order.items
    .map(
      (i) =>
        `- ${i.product.name}  ${i.quantity}x ${i.unitPrice} -> ${i.unitPrice * i.quantity} ${currencyCode}`,
    )
    .join("\n");

  const showBreakdown =
    order.discountCode != null || order.discountAmount > 0;

  const totalsBlock = showBreakdown
    ? [
        `${i18n.subtotal}: ${order.subtotalBeforeDiscount} ${currencyCode}`,
        `${i18n.discount}${order.discountPercent != null && order.discountPercent > 0 ? ` −${order.discountPercent}%` : ""}${order.discountCode ? ` (${order.discountCode})` : ""}: −${order.discountAmount} ${currencyCode}`,
        `${i18n.total}: ${order.total} ${currencyCode}`,
      ].join("\n")
    : `${i18n.total}: ${order.total} ${currencyCode}`;

  return [
    `${i18n.title} #${order.id} · AI Testing Shop (demo)`,
    ``,
    lines,
    ``,
    totalsBlock,
    ``,
    `${i18n.bankTransfer}: ${bank.note}`,
    `IBAN: ${bank.iban}  ${i18n.variableSymbol}: ${bank.variableSymbol}`,
    `${i18n.amount}: ${bank.amount.value} ${bank.amount.currencyCode}`,
  ].join("\n");
}

export async function sendBankTransferOrderEmail(args: {
  to: string;
  order: OrderWithLines;
  bankTransfer: BankTransferMailInfo;
  lang?: MailLang;
}): Promise<SendBankTransferMailResult> {
  const lang: MailLang = args.lang === "cs" ? "cs" : "en";
  const resolved = await createTransporterAndFrom();
  if (!resolved) {
    return {
      sent: false,
      error:
        "SMTP not configured (enable SMTP_USE_ETHEREAL=true or set SMTP_HOST and SMTP_FROM)",
    };
  }

  const html = buildOrderSummaryHtml(args.order, args.bankTransfer, lang);
  const text = buildOrderSummaryText(args.order, args.bankTransfer, lang);

  try {
    const info = await resolved.send({
      from: resolved.from,
      to: args.to,
      subject:
        lang === "cs"
          ? `[AI Testing Shop] Objednávka #${args.order.id} · pokyny k bankovnímu převodu`
          : `[AI Testing Shop] Order #${args.order.id} · bank transfer instructions`,
      text,
      html,
    });

    let previewUrl: string | undefined;
    if (resolved.isEthereal) {
      const url = nodemailer.getTestMessageUrl(info);
      previewUrl = typeof url === "string" ? url : undefined;
      if (previewUrl) {
        // eslint-disable-next-line no-console
        console.log("[Ethereal] Open this URL in a browser to read the message:");
        // eslint-disable-next-line no-console
        console.log(previewUrl);
      }
    }

    return { sent: true, previewUrl };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { sent: false, error: message };
  }
}
