import { Prisma } from "@prisma/client";
import { isFaultEnabled } from "../faults/faultService";
import {
  canonicalPromotionCode,
  normalizePromotionCode,
  resolveMoreIsLessFinalPercent,
} from "../shop/discountMoreIsLess";

const cartWithProduct = Prisma.validator<Prisma.CartItemDefaultArgs>()({
  include: {
    product: { include: { currency: true } },
  },
});

/** Same payload shape as `CartRow` in checkoutService. */
export type PricingCartRow = Prisma.CartItemGetPayload<typeof cartWithProduct>;

export type CheckoutOrderPricing = {
  grossSubtotal: number;
  discountAmount: number;
  discountPercent: number | null;
  discountCode: string | null;
  orderTotal: number;
};

export async function computeStorageOrderPricing(
  cartItems: PricingCartRow[],
  promotion: { appliedCode: string | null } | null,
): Promise<CheckoutOrderPricing> {
  let grossSubtotal = 0;
  let units = 0;
  for (const ci of cartItems) {
    grossSubtotal += ci.product.price * ci.quantity;
    units += ci.quantity;
  }

  const raw = promotion?.appliedCode?.trim() ?? "";
  const normalized = raw ? normalizePromotionCode(raw) : "";
  const canonical = normalized
    ? canonicalPromotionCode(normalized)
    : null;

  let discountPercent: number | null = null;
  let discountCode: string | null = null;

  if (canonical) {
    discountPercent = await resolveMoreIsLessFinalPercent(units);
    discountCode = canonical;
  }

  const discountAmount =
    discountCode != null
      ? Math.round((grossSubtotal * (discountPercent ?? 0)) / 100)
      : 0;

  let orderTotal = grossSubtotal - discountAmount;

  if (isFaultEnabled("cart_price_miscalculation")) {
    orderTotal = Math.floor(orderTotal * 0.9);
  }

  return {
    grossSubtotal,
    discountAmount,
    discountPercent,
    discountCode,
    orderTotal,
  };
}
