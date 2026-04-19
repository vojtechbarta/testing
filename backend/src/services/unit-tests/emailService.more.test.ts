import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateTestAccount,
  mockCreateTransport,
  mockGetTestMessageUrl,
  mockSendMail,
} = vi.hoisted(() => ({
  mockCreateTestAccount: vi.fn(),
  mockCreateTransport: vi.fn(),
  mockGetTestMessageUrl: vi.fn(),
  mockSendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTestAccount: mockCreateTestAccount,
    createTransport: mockCreateTransport,
    getTestMessageUrl: mockGetTestMessageUrl,
  },
}));

import { isEtherealMode, isSmtpConfigured, sendBankTransferOrderEmail } from "../emailService";

const ENV_KEYS = [
  "SMTP_USE_ETHEREAL",
  "USE_ETHEREAL_EMAIL",
  "SMTP_HOST",
  "SMTP_FROM",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

const SAVED_ENV: Record<string, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((k) => [k, process.env[k]]),
);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (SAVED_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = SAVED_ENV[key];
  }
}

describe("emailService additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns smtp not configured when neither ethereal nor host/from set", async () => {
    delete process.env.SMTP_USE_ETHEREAL;
    delete process.env.USE_ETHEREAL_EMAIL;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;

    const result = await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      lang: "en",
      order: {
        id: 1,
        total: 100,
        items: [],
        currency: { code: "CZK" },
      } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "1",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 100, currencyCode: "CZK" },
        note: "note",
      },
    });

    expect(result).toMatchObject({ sent: false });
  });

  it("sends via direct SMTP config", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "shop@example.test";
    mockSendMail.mockResolvedValue({ messageId: "m1" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    const result = await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      lang: "cs",
      order: {
        id: 2,
        total: 200,
        items: [
          {
            quantity: 1,
            unitPrice: 200,
            product: { name: "P" },
          },
        ],
        currency: { code: "CZK" },
      } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "2",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 200, currencyCode: "CZK" },
        note: "note",
      },
    });

    expect(result).toEqual({ sent: true, previewUrl: undefined });
    expect(mockSendMail).toHaveBeenCalled();
  });

  it("passes SMTP auth when SMTP_USER and SMTP_PASS are configured", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "shop@example.test";
    process.env.SMTP_USER = "smtp-user";
    process.env.SMTP_PASS = "smtp-pass";
    mockSendMail.mockResolvedValue({ messageId: "m-auth" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      order: { id: 22, total: 1, items: [], currency: { code: "CZK" } } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "22",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 1, currencyCode: "CZK" },
        note: "note",
      },
    });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: "smtp-user", pass: "smtp-pass" },
      }),
    );
  });

  it("uses ethereal mode and returns preview URL", async () => {
    process.env.SMTP_USE_ETHEREAL = "true";
    mockCreateTestAccount.mockResolvedValue({ user: "eth-user", pass: "eth-pass" });
    mockSendMail.mockResolvedValue({ messageId: "m2" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
    mockGetTestMessageUrl.mockReturnValue("https://ethereal.example/preview");

    expect(isEtherealMode()).toBe(true);
    expect(isSmtpConfigured()).toBe(true);

    const result = await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      order: {
        id: 3,
        total: 300,
        items: [],
        currency: { code: "CZK" },
      } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "3",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 300, currencyCode: "CZK" },
        note: "note",
      },
    });

    expect(result).toEqual({ sent: true, previewUrl: "https://ethereal.example/preview" });
  });

  it("ethereal mode keeps sent=true even when preview URL is unavailable", async () => {
    process.env.SMTP_USE_ETHEREAL = "true";
    mockCreateTestAccount.mockResolvedValue({ user: "eth-user2", pass: "eth-pass2" });
    mockSendMail.mockResolvedValue({ messageId: "m3" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
    mockGetTestMessageUrl.mockReturnValue(false);

    const result = await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      order: { id: 4, total: 40, items: [], currency: { code: "CZK" } } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "4",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 40, currencyCode: "CZK" },
        note: "note",
      },
    });
    expect(result).toEqual({ sent: true, previewUrl: undefined });
  });

  it("returns sent=false with error when sendMail throws", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "shop@example.test";
    mockSendMail.mockRejectedValue(new Error("smtp-failed"));
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    const result = await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      order: { id: 5, total: 50, items: [], currency: { code: "CZK" } } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "5",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 50, currencyCode: "CZK" },
        note: "note",
      },
    });

    expect(result).toEqual({ sent: false, error: "smtp-failed" });
  });

  it("includes subtotal/discount/total breakdown when discount fields are set", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "shop@example.test";
    mockSendMail.mockResolvedValue({ messageId: "disc-html" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      lang: "en",
      order: {
        id: 50,
        total: 900,
        subtotalBeforeDiscount: 1000,
        discountAmount: 100,
        discountPercent: 10,
        discountCode: "MOREISLESS",
        items: [{ quantity: 2, unitPrice: 500, product: { name: "SKU" } }],
        currency: { code: "CZK" },
      } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "50",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 900, currencyCode: "CZK" },
        note: "note",
      },
    });

    const payload = mockSendMail.mock.calls[0]?.[0] as { html: string; text: string };
    expect(payload.html).toContain("Subtotal");
    expect(payload.html).toContain("Discount");
    expect(payload.html).toContain("MOREISLESS");
    expect(payload.text).toContain("Subtotal:");
    expect(payload.text).toMatch(/10%/);
  });

  it("omits percent suffix in plain-text discount line when discountPercent is missing", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "shop@example.test";
    mockSendMail.mockResolvedValue({ messageId: "disc-txt" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    await sendBankTransferOrderEmail({
      to: "buyer@example.test",
      lang: "en",
      order: {
        id: 51,
        total: 450,
        subtotalBeforeDiscount: 500,
        discountAmount: 50,
        discountPercent: null,
        discountCode: null,
        items: [{ quantity: 1, unitPrice: 500, product: { name: "A" } }],
        currency: { code: "CZK" },
      } as any,
      bankTransfer: {
        beneficiary: "Demo",
        iban: "CZ00",
        bic: "BIC",
        bankName: "Bank",
        variableSymbol: "51",
        specificSymbol: "S",
        constantSymbol: "C",
        amount: { value: 450, currencyCode: "CZK" },
        note: "note",
      },
    });

    const payload = mockSendMail.mock.calls[0]?.[0] as { text: string };
    expect(payload.text).toContain("Discount:");
    expect(payload.text).not.toMatch(/\d+%/);
  });
});
