import prisma from "../db/prisma";
import { isFaultEnabled } from "../faults/faultService";
import { PaymentMethod } from "@prisma/client";

type OrderItemInput = {
  productId: number;
  quantity: number;
};

/** Direct order API (no stock change). Prefer /checkout for storefront checkout. */
export async function createOrder(userId: number, items: OrderItemInput[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    include: { currency: true },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const currencyId = products[0]?.currencyId ?? products[0]?.currency?.id ?? null;

  let orderTotal = 0;
  const orderItemsData: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }
    const unitPrice = product.price;
    orderTotal += unitPrice * item.quantity;
    orderItemsData.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
    });
  }

  if (isFaultEnabled("cart_price_miscalculation")) {
    orderTotal = Math.floor(orderTotal * 0.9);
  }

  const order = await prisma.order.create({
    data: {
      userId,
      total: orderTotal,
      currencyId: currencyId ?? undefined,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      customerEmail: "legacy-api@example.com",
      customerFirstName: "Legacy",
      customerLastName: "API",
      customerPhone: "n/a",
      items: {
        create: orderItemsData.map((oi) => ({
          ...oi,
          currencyId: currencyId ?? undefined,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  return order;
}

