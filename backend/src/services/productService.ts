import prisma from "../db/prisma";
import { getFaultSettings, isFaultEnabled } from "../faults/faultService";

export async function getAllProducts() {
  if (isFaultEnabled("productListing_latency")) {
    const settings = getFaultSettings("productListing_latency");
    const latency = settings?.latencyMs ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  return prisma.product.findMany({
    where: { active: true },
  });
}

export function getAllProductsForAdmin() {
  return prisma.product.findMany({
    orderBy: { id: "asc" },
  });
}

export function updateProduct(
  id: number,
  data: {
    name: string;
    description: string;
    priceCents: number;
    inStock: number;
    active: boolean;
  },
) {
  return prisma.product.update({
    where: { id },
    data,
  });
}

export function createProduct(data: {
  name: string;
  description: string;
  priceCents: number;
  inStock: number;
  active: boolean;
}) {
  return prisma.product.create({ data });
}

