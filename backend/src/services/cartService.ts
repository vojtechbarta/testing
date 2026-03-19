import prisma from "../db/prisma";

const DEFAULT_USER_ID = 1;

export async function getCart(userId: number = DEFAULT_USER_ID) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  const totalCents = items.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0,
  );

  return {
    userId,
    items: items.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      quantity: i.quantity,
      priceCents: i.product.priceCents,
      inStock: i.product.inStock,
      lineTotalCents: i.product.priceCents * i.quantity,
    })),
    totalCents,
  };
}

export async function addOrUpdateCartItem(
  productId: number,
  quantity: number,
  userId: number = DEFAULT_USER_ID,
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product || !product.active) {
    throw new Error("Produkt není dostupný.");
  }

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: { userId, productId },
    });
    return getCart(userId);
  }

  if (quantity > product.inStock) {
    throw new Error(`Nelze přidat více než ${product.inStock} ks na skladě.`);
  }

  const existing = await prisma.cartItem.findFirst({
    where: { userId, productId },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        userId,
        productId,
        quantity,
      },
    });
  }

  return getCart(userId);
}

export async function clearCart(userId: number = DEFAULT_USER_ID) {
  await prisma.cartItem.deleteMany({ where: { userId } });
}

