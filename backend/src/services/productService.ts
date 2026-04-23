import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma";
import { getFaultSettings, isFaultEnabled } from "../faults/faultService";
import type { StorefrontLang } from "../shop/storefrontMoney";

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

export type ProductTranslationDto = {
  locale: string;
  name: string;
  description: string;
};

export function mapProductToDto(p: {
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
    // Stored integer is display amount in product currency for this demo (not cents).
    price: { amount: p.price, currencyCode: p.currency?.code ?? "EUR" },
  };
}

/**
 * Storefront listing filter: active products only; optional `contains` on name OR description (collation is DB-defined).
 * Exported for unit tests.
 */
export function productListingWhere(
  searchQuery?: string,
  lang: StorefrontLang = "en",
): Prisma.ProductWhereInput {
  const q = searchQuery?.trim();
  const where: Prisma.ProductWhereInput = { active: true };
  if (q) {
    const baseOr: Prisma.ProductWhereInput[] = [
      { name: { contains: q } },
      { description: { contains: q } },
    ];
    if (lang === "cs") {
      baseOr.push({
        translations: {
          some: {
            locale: "cs",
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          },
        },
      });
    }
    where.OR = baseOr;
  }
  return where;
}

export async function getAllProducts(
  searchQuery?: string,
  lang: StorefrontLang = "en",
): Promise<ProductDto[]> {
  if (isFaultEnabled("productListing_latency")) {
    const settings = getFaultSettings("productListing_latency");
    const latency = settings?.latencyMs ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  const where = productListingWhere(searchQuery, lang);

  const products = await prisma.product.findMany({
    where,
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
  const code = currencyCode ?? "EUR";
  const currency = await prisma.currency.findUnique({ where: { code } });
  if (!currency) {
    // for now: create missing currency; in this project we seed EUR anyway.
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

export async function getProductTranslationsForAdmin(
  productId: number,
): Promise<ProductTranslationDto[]> {
  const rows = await prisma.productTranslation.findMany({
    where: { productId },
    select: { locale: true, name: true, description: true },
    orderBy: { locale: "asc" },
  });
  return rows;
}

export async function upsertProductTranslation(
  productId: number,
  locale: string,
  data: { name: string; description: string },
): Promise<ProductTranslationDto> {
  const row = await prisma.productTranslation.upsert({
    where: {
      product_locale_unique: { productId, locale },
    },
    update: {
      name: data.name,
      description: data.description,
    },
    create: {
      productId,
      locale,
      name: data.name,
      description: data.description,
    },
    select: { locale: true, name: true, description: true },
  });
  return row;
}

/** Removes cart/order line references so the product row can be deleted (no CASCADE on Product in schema). */
export async function deleteProduct(id: number): Promise<void> {
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { productId: id } }),
    prisma.orderItem.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
}

