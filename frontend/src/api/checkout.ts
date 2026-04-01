import { API_BASE_URL, cartSessionHeaders } from "./client";

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
): Promise<{
  order: unknown;
  bankTransfer: BankTransferDetails;
  emailConfigured: boolean;
  emailSent: boolean;
  emailPreviewUrl?: string;
  emailError?: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE_URL}/checkout/bank-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartSessionHeaders() },
    body: JSON.stringify(buyer),
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
): Promise<{ order: { id: number }; nextStep: string }> {
  const res = await fetch(`${API_BASE_URL}/checkout/gateway/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartSessionHeaders() },
    body: JSON.stringify(buyer),
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

export async function checkoutMockPay(orderId: number): Promise<{
  success: boolean;
  orderId: number;
  message: string;
  mockPaymentBehavior?: string;
  mockRandomRollSuccess?: boolean;
}> {
  const res = await fetch(
    `${API_BASE_URL}/checkout/gateway/${orderId}/mock-pay`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
