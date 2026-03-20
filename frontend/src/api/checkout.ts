const API_BASE = "http://localhost:4000";

export type BuyerFormPayload = {
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
};

export type BankTransferDetails = {
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

export async function checkoutBankTransfer(
  buyer: BuyerFormPayload,
  userId = 1,
): Promise<{
  order: unknown;
  bankTransfer: BankTransferDetails;
  emailConfigured: boolean;
  emailSent: boolean;
  emailPreviewUrl?: string;
  emailError?: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/checkout/bank-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...buyer }),
  });
  if (!res.ok) {
    let message = `Checkout failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function checkoutGatewayInit(
  buyer: BuyerFormPayload,
  userId = 1,
): Promise<{ order: { id: number }; nextStep: string }> {
  const res = await fetch(`${API_BASE}/checkout/gateway/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...buyer }),
  });
  if (!res.ok) {
    let message = `Could not start payment (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export type MockOutcome = "success" | "failure" | "random";

export async function checkoutMockPay(
  orderId: number,
  outcome: MockOutcome,
): Promise<{
  success: boolean;
  orderId: number;
  message: string;
}> {
  const res = await fetch(
    `${API_BASE}/checkout/gateway/${orderId}/mock-pay`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    },
  );
  if (!res.ok) {
    let message = `Mock payment failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}
