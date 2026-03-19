import prisma from "../db/prisma";
import { getFaultSettings, isFaultEnabled } from "../faults/faultService";

export type Money = {
  amount: number;
  currencyCode: string;
};

export type ProductDto = {
  id: number;
  name: string;
  description: string;
  inStock: number;
  active: boolean;
  price: Money;
};

function mapProductToDto(p: {
  id: number;
  name: string;
  description: string;
  inStock: number;
  active: boolean;
  price: number;
  currency?: { code: string } | null;
}): ProductDto {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    inStock: p.inStock,
    active: p.active,
    // Stored integer is the display amount in CZK for this demo (not cents).
    price: { amount: p.price, currencyCode: p.currency?.code ?? "CZK" },
  };
}

export async function getAllProducts(): Promise<ProductDto[]> {
  if (isFaultEnabled("productListing_latency")) {
    const settings = getFaultSettings("productListing_latency");
    const latency = settings?.latencyMs ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { currency: true },
  });

  return products.map(mapProductToDto);
}

export async function getAllProductsForAdmin(): Promise<ProductDto[]> {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    include: { currency: true },
  });

  return products.map(mapProductToDto);
}

async function upsertProductCurrencyId(currencyCode?: string) {
  const code = currencyCode ?? "CZK";
  const currency = await prisma.currency.findUnique({ where: { code } });
  if (!currency) {
    // for now: create missing currency; in this project we seed CZK anyway.
    return prisma.currency.create({ data: { code } });
  }
  return currency;
}

export async function updateProduct(
  id: number,
  data: {
    name: string;
    description: string;
    price: Money;
    inStock: number;
    active: boolean;
  },
) {
  const currency = await upsertProductCurrencyId(data.price.currencyCode);

  return prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      inStock: data.inStock,
      active: data.active,
      price: Math.round(data.price.amount),
      currencyId: currency.id,
    },
    include: { currency: true },
  }).then(mapProductToDto);
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: Money;
  inStock: number;
  active: boolean;
  currencyCode?: string;
}) {
  const currency = await upsertProductCurrencyId(data.price.currencyCode);

  return prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      inStock: data.inStock,
      active: data.active,
      price: Math.round(data.price.amount),
      currencyId: currency.id,
    },
    include: { currency: true },
  }).then(mapProductToDto);
}

