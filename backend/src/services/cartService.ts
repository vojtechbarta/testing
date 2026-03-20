import prisma from "../db/prisma";
import { shouldTriggerFault, FAULT_KEYS } from "../faults/faultRuntime";

export async function getCart(cartKey: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartKey },
    include: { product: { include: { currency: true } } },
    orderBy: { createdAt: "asc" },
  });

  const cartTotal = items.reduce((sum, item) => {
    return sum + item.product.price * item.quantity;
  }, 0);

  const currencyCode = items[0]?.product.currency?.code ?? "CZK";

  return {
    cartSessionId: cartKey,
    items: items.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      quantity: i.quantity,
      price: {
        amount: i.product.price,
        currencyCode: i.product.currency?.code ?? "CZK",
      },
      inStock: i.product.inStock,
      lineTotal: {
        amount: i.product.price * i.quantity,
        currencyCode: i.product.currency?.code ?? "CZK",
      },
    })),
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
    return getCart(cartKey);
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

  return getCart(cartKey);
}

export async function clearCart(cartKey: string) {
  await prisma.cartItem.deleteMany({ where: { cartKey } });
}
