import prisma from "../db/prisma";
import { shouldTriggerFault, FAULT_KEYS } from "../faults/faultRuntime";
import {
  canonicalPromotionCode,
  normalizePromotionCode,
  resolveMoreIsLessFinalPercent,
} from "../shop/discountMoreIsLess";
import {
  loadEurPerCzkRate,
  multiplyStorefrontMoney,
  toStorefrontMoney,
} from "../shop/storefrontMoney";
import { storefrontProductName } from "../shop/storefrontProductText";
import type { StorefrontLang } from "../shop/storefrontMoney";

export type CartDiscountDto = {
  code: string;
  percent: number;
  amount: number;
  currencyCode: string;
};

export type CartDto = {
  cartSessionId: string;
  items: Array<{
    productId: number;
    name: string;
    quantity: number;
    price: { amount: number; currencyCode: string };
    inStock: number;
    lineTotal: { amount: number; currencyCode: string };
  }>;
  subtotal: { amount: number; currencyCode: string };
  discount: CartDiscountDto | null;
  total: { amount: number; currencyCode: string };
};

function roundMoneyAmount(amount: number, currencyCode: string): number {
  const decimals = currencyCode === "CZK" ? 0 : 2;
  const f = 10 ** decimals;
  return Math.round(amount * f) / f;
}

export async function getCart(
  cartKey: string,
  lang: StorefrontLang = "en",
): Promise<CartDto> {
  const items = await prisma.cartItem.findMany({
    where: { cartKey },
    include: { product: { include: { currency: true } } },
    orderBy: { createdAt: "asc" },
  });

  const promotion = await prisma.cartPromotion.findUnique({
    where: { cartKey },
  });

  const eurPerCzk = await loadEurPerCzkRate();

  const mappedItems = items.map((i) => {
    const storageCode = i.product.currency?.code ?? "CZK";
    const unit = toStorefrontMoney(
      i.product.price,
      storageCode,
      lang,
      eurPerCzk,
    );
    const lineTotal = multiplyStorefrontMoney(unit, i.quantity);
    return {
      productId: i.productId,
      name: storefrontProductName(i.product.id, i.product.name, lang),
      quantity: i.quantity,
      price: unit,
      inStock: i.product.inStock,
      lineTotal,
    };
  });

  const currencyCode = mappedItems[0]?.lineTotal.currencyCode ?? "CZK";

  if (mappedItems.length === 0) {
    if (promotion) {
      await prisma.cartPromotion.deleteMany({ where: { cartKey } });
    }
    return {
      cartSessionId: cartKey,
      items: [],
      subtotal: { amount: 0, currencyCode },
      discount: null,
      total: { amount: 0, currencyCode },
    };
  }

  const cartSubtotalRaw = mappedItems.reduce(
    (sum, item) => sum + item.lineTotal.amount,
    0,
  );
  const subtotalAmount = roundMoneyAmount(cartSubtotalRaw, currencyCode);

  const totalUnits = mappedItems.reduce((s, i) => s + i.quantity, 0);

  const normalizedPromo = normalizePromotionCode(promotion?.appliedCode);
  const canonical =
    normalizedPromo.length > 0
      ? canonicalPromotionCode(normalizedPromo)
      : null;

  if (normalizedPromo.length > 0 && !canonical) {
    await prisma.cartPromotion.delete({ where: { cartKey } });
  }

  let discount: CartDiscountDto | null = null;
  let totalAmount = subtotalAmount;

  if (canonical) {
    const percent = await resolveMoreIsLessFinalPercent(totalUnits);
    const discountRaw = (subtotalAmount * percent) / 100;
    const discountAmount = roundMoneyAmount(discountRaw, currencyCode);
    totalAmount = roundMoneyAmount(
      subtotalAmount - discountAmount,
      currencyCode,
    );
    discount = {
      code: canonical,
      percent,
      amount: discountAmount,
      currencyCode,
    };
  }

  return {
    cartSessionId: cartKey,
    items: mappedItems,
    subtotal: { amount: subtotalAmount, currencyCode },
    discount,
    total: { amount: totalAmount, currencyCode },
  };
}

export async function applyCartPromotion(
  cartKey: string,
  rawCode: string | null | undefined,
  lang: StorefrontLang = "en",
): Promise<CartDto> {
  const trimmed = String(rawCode ?? "").trim();
  if (trimmed === "") {
    await prisma.cartPromotion.deleteMany({ where: { cartKey } });
    return getCart(cartKey, lang);
  }

  const normalized = normalizePromotionCode(trimmed);
  if (!canonicalPromotionCode(normalized)) {
    throw new Error("Unknown promotion code.");
  }

  await prisma.cartPromotion.upsert({
    where: { cartKey },
    create: { cartKey, appliedCode: normalized },
    update: { appliedCode: normalized },
  });

  return getCart(cartKey, lang);
}

export async function addOrUpdateCartItem(
  cartKey: string,
  productId: number,
  quantity: number,
  lang: StorefrontLang = "en",
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product || !product.active) {
    throw new Error("Product is not available.");
  }

  const currencyId = product.currencyId ?? undefined;

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: { cartKey, productId },
    });
    return getCart(cartKey, lang);
  }

  const existing = await prisma.cartItem.findFirst({
    where: { cartKey, productId },
  });

  if (quantity > (existing?.quantity ?? 0)) {
    const shouldTrigger = await shouldTriggerFault(
      FAULT_KEYS.unitCartAddDoubleQuantityPersist,
    );
    if (shouldTrigger) {
      const existingQty = existing?.quantity ?? 0;
      const delta = quantity - existingQty;
      quantity = existingQty + delta * 2;
    }
  }

  if (quantity > product.inStock) {
    throw new Error(`Cannot add more than ${product.inStock} items in stock.`);
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity, currencyId },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartKey,
        productId,
        quantity,
        currencyId,
      },
    });
  }

  return getCart(cartKey, lang);
}

export async function clearCart(cartKey: string) {
  await prisma.cartItem.deleteMany({ where: { cartKey } });
  await prisma.cartPromotion.deleteMany({ where: { cartKey } });
}
