import prisma from "../db/prisma";
import { isFaultEnabled } from "../faults/faultService";
import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { loadMockPaymentOutcomeForEmail } from "./mockPaymentConfigService";

export type { MockPayOutcome } from "./mockPaymentConfigService";

/** Demo storefront: guest orders attach to this User for FK consistency. Cart scoping is via `guestCartKey` / `CartItem.cartKey`. */
export const STOREFRONT_DEMO_USER_ID = 1;

const cartWithProduct = Prisma.validator<Prisma.CartItemDefaultArgs>()({
  include: {
    product: { include: { currency: true } },
  },
});

export type CartRow = Prisma.CartItemGetPayload<typeof cartWithProduct>;

export type BuyerPayload = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export function validateBuyer(b: BuyerPayload) {
  const pairs: [string, string][] = [
    ["customerEmail", b.email],
    ["customerFirstName", b.firstName],
    ["customerLastName", b.lastName],
    ["customerPhone", b.phone],
  ];
  for (const [field, val] of pairs) {
    if (val === undefined || val === null || String(val).trim() === "") {
      throw new Error(`${field} is required`);
    }
  }
}

function trimOrNull(v: string | null | undefined) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function cartRowsToOrderPayload(cartItems: CartRow[]) {
  let orderTotal = 0;
  const orderItemsData: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[] = [];

  const currencyId =
    cartItems[0]?.product.currencyId ??
    cartItems[0]?.product.currency?.id ??
    null;

  for (const ci of cartItems) {
    const p = ci.product;
    orderTotal += p.price * ci.quantity;
    orderItemsData.push({
      productId: ci.productId,
      quantity: ci.quantity,
      unitPrice: p.price,
    });
  }

  if (isFaultEnabled("cart_price_miscalculation")) {
    orderTotal = Math.floor(orderTotal * 0.9);
  }

  return { orderTotal, orderItemsData, currencyId };
}

function assertCartRowsValidForCheckout(cartItems: CartRow[]) {
  for (const ci of cartItems) {
    const p = ci.product;
    if (!p.active) {
      throw new Error(`Product "${p.name}" is not available`);
    }
    if (p.inStock < ci.quantity) {
      throw new Error(`Insufficient stock for "${p.name}"`);
    }
  }
}

export async function checkoutBankTransfer(
  cartKey: string,
  buyer: BuyerPayload,
) {
  validateBuyer(buyer);

  return prisma.$transaction(async (tx) => {
    const cartItems = await tx.cartItem.findMany({
      where: { cartKey },
      include: { product: { include: { currency: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    assertCartRowsValidForCheckout(cartItems);

    const { orderTotal, orderItemsData, currencyId } =
      cartRowsToOrderPayload(cartItems);

    const order = await tx.order.create({
      data: {
        userId: STOREFRONT_DEMO_USER_ID,
        guestCartKey: cartKey,
        total: orderTotal,
        currencyId: currencyId ?? undefined,
        status: OrderStatus.PAID,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        customerEmail: buyer.email.trim(),
        customerFirstName: buyer.firstName.trim(),
        customerLastName: buyer.lastName.trim(),
        customerPhone: buyer.phone.trim(),
        addressLine1: trimOrNull(buyer.addressLine1),
        addressLine2: trimOrNull(buyer.addressLine2),
        city: trimOrNull(buyer.city),
        postalCode: trimOrNull(buyer.postalCode),
        country: trimOrNull(buyer.country),
        items: {
          create: orderItemsData.map((oi) => {
            const row: {
              productId: number;
              quantity: number;
              unitPrice: number;
              currencyId?: number;
            } = {
              productId: oi.productId,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
            };
            if (currencyId != null) row.currencyId = currencyId;
            return row;
          }),
        },
      },
      include: { items: { include: { product: true } }, currency: true },
    });

    for (const ci of cartItems) {
      await tx.product.update({
        where: { id: ci.productId },
        data: { inStock: { decrement: ci.quantity } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartKey } });

    return order;
  });
}

export async function checkoutGatewayInit(
  cartKey: string,
  buyer: BuyerPayload,
) {
  validateBuyer(buyer);

  const existingPending = await prisma.order.findFirst({
    where: {
      userId: STOREFRONT_DEMO_USER_ID,
      guestCartKey: cartKey,
      status: OrderStatus.PENDING,
      paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
    },
    orderBy: { id: "desc" },
    include: { items: { include: { product: true } }, currency: true },
  });

  if (existingPending) {
    return existingPending;
  }

  return prisma.$transaction(async (tx) => {
    const cartItems = await tx.cartItem.findMany({
      where: { cartKey },
      include: { product: { include: { currency: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    assertCartRowsValidForCheckout(cartItems);

    const { orderTotal, orderItemsData, currencyId } =
      cartRowsToOrderPayload(cartItems);

    const order = await tx.order.create({
      data: {
        userId: STOREFRONT_DEMO_USER_ID,
        guestCartKey: cartKey,
        total: orderTotal,
        currencyId: currencyId ?? undefined,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: buyer.email.trim(),
        customerFirstName: buyer.firstName.trim(),
        customerLastName: buyer.lastName.trim(),
        customerPhone: buyer.phone.trim(),
        addressLine1: trimOrNull(buyer.addressLine1),
        addressLine2: trimOrNull(buyer.addressLine2),
        city: trimOrNull(buyer.city),
        postalCode: trimOrNull(buyer.postalCode),
        country: trimOrNull(buyer.country),
        items: {
          create: orderItemsData.map((oi) => {
            const row: {
              productId: number;
              quantity: number;
              unitPrice: number;
              currencyId?: number;
            } = {
              productId: oi.productId,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
            };
            if (currencyId != null) row.currencyId = currencyId;
            return row;
          }),
        },
      },
      include: { items: { include: { product: true } }, currency: true },
    });

    return order;
  });
}

export async function mockGatewayPayment(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      currency: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.paymentMethod !== PaymentMethod.PAYMENT_GATEWAY) {
    throw new Error("Order is not using the payment gateway flow");
  }

  if (order.status !== OrderStatus.PENDING) {
    throw new Error(
      `Payment cannot be processed for order in status ${order.status}`,
    );
  }

  const behavior = loadMockPaymentOutcomeForEmail(order.customerEmail);

  let paymentSucceeded: boolean;
  let mockRandomRollSuccess: boolean | undefined;
  if (behavior === "random") {
    mockRandomRollSuccess = Math.random() >= 0.5;
    paymentSucceeded = mockRandomRollSuccess;
  } else {
    paymentSucceeded = behavior === "success";
  }

  if (!paymentSucceeded) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
    return {
      success: false as const,
      orderId,
      message: "Mock payment gateway declined the payment.",
      mockPaymentBehavior: behavior,
      ...(behavior === "random"
        ? { mockRandomRollSuccess: mockRandomRollSuccess! }
        : {}),
    };
  }

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!fresh || fresh.status !== OrderStatus.PENDING) {
      throw new Error("Order is no longer awaiting payment");
    }

    for (const oi of fresh.items) {
      const product = await tx.product.findUnique({
        where: { id: oi.productId },
      });
      if (!product || product.inStock < oi.quantity) {
        throw new Error(
          `Insufficient stock for product ${oi.productId} at payment capture`,
        );
      }
    }

    for (const oi of fresh.items) {
      await tx.product.update({
        where: { id: oi.productId },
        data: { inStock: { decrement: oi.quantity } },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID },
    });

    const sessionKey = fresh.guestCartKey;
    if (sessionKey) {
      await tx.cartItem.deleteMany({ where: { cartKey: sessionKey } });
    }
  });

  return {
    success: true as const,
    orderId,
    message: "Mock payment gateway completed successfully.",
    mockPaymentBehavior: behavior,
    ...(behavior === "random"
      ? { mockRandomRollSuccess: mockRandomRollSuccess! }
      : {}),
  };
}

export function buildDummyBankTransferInfo(order: {
  id: number;
  total: number;
  currency?: { code: string } | null;
}) {
  const currencyCode = order.currency?.code ?? "CZK";
  return {
    beneficiary: "AI Testing Shop Demo s.r.o.",
    iban: "CZ65 0800 0000 1920 0014 5399",
    bic: "GIBACZPX",
    bankName: "Czech Demo Bank N.A. (fictitious)",
    variableSymbol: String(900_000_000 + order.id),
    specificSymbol: "AITEST",
    constantSymbol: "0308",
    amount: { value: order.total, currencyCode },
    note: "DUMMY PAYMENT DETAILS — do not send real money. For demo / testing only.",
  };
}
