import prisma from "../db/prisma";
import { isFaultEnabled } from "../faults/faultService";

type OrderItemInput = {
  productId: number;
  quantity: number;
};

export async function createOrder(userId: number, items: OrderItemInput[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalCents = 0;
  const orderItemsData: {
    productId: number;
    quantity: number;
    unitPriceCents: number;
  }[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }
    const unitPriceCents = product.priceCents;
    totalCents += unitPriceCents * item.quantity;
    orderItemsData.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents,
    });
  }

  if (isFaultEnabled("cart_price_miscalculation")) {
    totalCents = Math.floor(totalCents * 0.9);
  }

  const order = await prisma.order.create({
    data: {
      userId,
      totalCents,
      items: {
        create: orderItemsData,
      },
    },
    include: {
      items: true,
    },
  });

  return order;
}

