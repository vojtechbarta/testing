import prisma from "../../db/prisma";

type CleanupOptions = {
  cartKeys?: string[];
  cleanupProducts?: boolean;
  productIds?: number[];
};

export async function cleanupIntegrationFixtures(options: CleanupOptions = {}) {
  const { cartKeys = [], cleanupProducts = false, productIds = [] } = options;

  if (cartKeys.length > 0) {
    await prisma.cartItem.deleteMany({
      where: { cartKey: { in: cartKeys } },
    });
    await prisma.cartPromotion.deleteMany({
      where: { cartKey: { in: cartKeys } },
    });
  }

  if (cleanupProducts) {
    const products = await prisma.product.findMany({
      where: { name: { startsWith: "Integration API Product" } },
      select: { id: true },
    });
    const productIdsByPrefix = products.map((p) => p.id);
    if (productIdsByPrefix.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { productId: { in: productIdsByPrefix } },
      });
      await prisma.cartItem.deleteMany({
        where: { productId: { in: productIdsByPrefix } },
      });
    }
    await prisma.product.deleteMany({
      where: { name: { startsWith: "Integration API Product" } },
    });
  }

  if (productIds.length > 0) {
    await prisma.orderItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.cartItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });
  }
}
