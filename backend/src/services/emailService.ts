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

function formatMoney(amount: number, code: string) {
  try {
    return new Intl.NumberFormat("en-US", {
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
) {
  const currencyCode = order.currency?.code ?? "CZK";
  const lines = order.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.product.name)}</td><td style="text-align:right">${i.quantity}×</td><td style="text-align:right">${formatMoney(i.unitPrice, currencyCode)}</td><td style="text-align:right">${formatMoney(i.unitPrice * i.quantity, currencyCode)}</td></tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order #${order.id}</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h1>Order confirmation · AI Testing Shop (demo)</h1>
  <p>Thank you for your order. <strong>This is a test storefront</strong>; bank details below are dummy unless your operator replaced them.</p>
  <p><strong>Order #${order.id}</strong></p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">
    <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Line</th></tr></thead>
    <tbody>${lines}</tbody>
    <tfoot><tr><th colspan="3" style="text-align:right">Total</th><th style="text-align:right">${formatMoney(order.total, currencyCode)}</th></tr></tfoot>
  </table>
  <h2>Bank transfer (dummy)</h2>
  <p style="color:#b45309"><strong>${escapeHtml(bank.note)}</strong></p>
  <table style="max-width:480px">
    <tr><td>Beneficiary</td><td>${escapeHtml(bank.beneficiary)}</td></tr>
    <tr><td>IBAN</td><td><code>${escapeHtml(bank.iban)}</code></td></tr>
    <tr><td>BIC</td><td><code>${escapeHtml(bank.bic)}</code></td></tr>
    <tr><td>Bank</td><td>${escapeHtml(bank.bankName)}</td></tr>
    <tr><td>Variable symbol</td><td><code>${escapeHtml(bank.variableSymbol)}</code></td></tr>
    <tr><td>Amount</td><td><strong>${formatMoney(bank.amount.value, bank.amount.currencyCode)}</strong></td></tr>
  </table>
  <p style="margin-top:2rem;font-size:12px;color:#666">This message is HTML + plain text only. A real shop might attach a PDF invoice here.</p>
</body>
</html>`.trim();
}

function buildOrderSummaryText(
  order: OrderWithLines,
  bank: BankTransferMailInfo,
) {
  const currencyCode = order.currency?.code ?? "CZK";
  const lines = order.items
    .map(
      (i) =>
        `- ${i.product.name}  ${i.quantity}x ${i.unitPrice} -> ${i.unitPrice * i.quantity} ${currencyCode}`,
    )
    .join("\n");
  return [
    `Order #${order.id} · AI Testing Shop (demo)`,
    ``,
    lines,
    ``,
    `Total: ${order.total} ${currencyCode}`,
    ``,
    `Bank transfer (dummy): ${bank.note}`,
    `IBAN: ${bank.iban}  Variable symbol: ${bank.variableSymbol}`,
    `Amount: ${bank.amount.value} ${bank.amount.currencyCode}`,
  ].join("\n");
}

export async function sendBankTransferOrderEmail(args: {
  to: string;
  order: OrderWithLines;
  bankTransfer: BankTransferMailInfo;
}): Promise<SendBankTransferMailResult> {
  const resolved = await createTransporterAndFrom();
  if (!resolved) {
    return {
      sent: false,
      error:
        "SMTP not configured (enable SMTP_USE_ETHEREAL=true or set SMTP_HOST and SMTP_FROM)",
    };
  }

  const html = buildOrderSummaryHtml(args.order, args.bankTransfer);
  const text = buildOrderSummaryText(args.order, args.bankTransfer);

  try {
    const info = await resolved.send({
      from: resolved.from,
      to: args.to,
      subject: `[AI Testing Shop] Order #${args.order.id} · bank transfer instructions`,
      text,
      html,
    });

    let previewUrl: string | undefined;
    if (resolved.isEthereal) {
      const url = nodemailer.getTestMessageUrl(info);
      previewUrl = url ?? undefined;
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
