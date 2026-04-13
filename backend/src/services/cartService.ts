import prisma from "../db/prisma";
import { shouldTriggerFault, FAULT_KEYS } from "../faults/faultRuntime";
import {
  loadEurPerCzkRate,
  multiplyStorefrontMoney,
  toStorefrontMoney,
} from "../shop/storefrontMoney";
import { storefrontProductName } from "../shop/storefrontProductText";
import type { StorefrontLang } from "../shop/storefrontMoney";

export async function getCart(cartKey: string, lang: StorefrontLang = "en") {
  const items = await prisma.cartItem.findMany({
    where: { cartKey },
    include: { product: { include: { currency: true } } },
    orderBy: { createdAt: "asc" },
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

  const cartTotalRaw = mappedItems.reduce(
    (sum, item) => sum + item.lineTotal.amount,
    0,
  );

  const currencyCode = mappedItems[0]?.lineTotal.currencyCode ?? "CZK";
  const decimals = currencyCode === "CZK" ? 0 : 2;
  const cartTotal =
    Math.round(cartTotalRaw * 10 ** decimals) / 10 ** decimals;

  return {
    cartSessionId: cartKey,
    items: mappedItems,
    total: {
      amount: cartTotal,
      currencyCode,
    },
  };
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
}
