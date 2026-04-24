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
  categoryId: number;
  category: string;
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
  categoryId: number;
  categoryName?: string;
  inStock: number;
  active: boolean;
  price: number;
  currency?: { code: string } | null;
}): ProductDto {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    category: p.categoryName ?? "other",
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
  category?: string,
  categoryMulti?: string[],
): Promise<ProductDto[]> {
  if (isFaultEnabled("productListing_latency")) {
    const settings = getFaultSettings("productListing_latency");
    const latency = settings?.latencyMs ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  const where = productListingWhere(searchQuery, lang);
  const categoryNames = [
    ...(category?.trim() ? [category.trim()] : []),
    ...(categoryMulti ?? []).map((c) => c.trim()).filter(Boolean),
  ];
  if (categoryNames.length > 0) {
    const categoryIds = await resolveCategoryIdsByName(categoryNames);
    if (categoryIds.length === 0) {
      return [];
    }
    where.categoryId = { in: categoryIds };
  }

  const products = await prisma.product.findMany({
    where,
    include: { currency: true },
  });
  const categoryMap = await loadCategoryNameMap(products.map((p) => p.categoryId));
  return products.map((product) =>
    mapProductToDto({ ...product, categoryName: categoryMap.get(product.categoryId) ?? "other" }),
  );
}

export async function getAllProductsForAdmin(): Promise<ProductDto[]> {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    include: { currency: true },
  });
  const categoryMap = await loadCategoryNameMap(products.map((p) => p.categoryId));
  return products.map((product) =>
    mapProductToDto({ ...product, categoryName: categoryMap.get(product.categoryId) ?? "other" }),
  );
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

const DEFAULT_CATEGORY_NAME = "other";

export async function getOrCreateCategory(data: {
  categoryId?: number;
  newCategoryName?: string;
}): Promise<{ id: number; name: string }> {
  const newCategoryName = data.newCategoryName?.trim();
  if (newCategoryName) {
    return prisma.category.upsert({
      where: { name: newCategoryName },
      update: {},
      create: { name: newCategoryName },
    });
  }

  if (data.categoryId !== undefined) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (category) {
      return category;
    }
  }

  return prisma.category.upsert({
    where: { name: DEFAULT_CATEGORY_NAME },
    update: {},
    create: { name: DEFAULT_CATEGORY_NAME },
  });
}

export async function getAllCategoriesForAdmin(): Promise<Array<{ id: number; name: string }>> {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function loadCategoryNameMap(categoryIds: number[]): Promise<Map<number, string>> {
  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length === 0) {
    return new Map();
  }
  const categories = await prisma.category.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true },
  });
  return new Map(categories.map((category) => [category.id, category.name]));
}

async function resolveCategoryIdsByName(categoryNames: string[]): Promise<number[]> {
  const uniqueNames = [...new Set(categoryNames)];
  if (uniqueNames.length === 0) {
    return [];
  }
  const categories = await prisma.category.findMany({
    where: { name: { in: uniqueNames } },
    select: { id: true },
  });
  return categories.map((category) => category.id);
}

export async function updateProduct(
  id: number,
  data: {
    name: string;
    description: string;
    price: Money;
    inStock: number;
    active: boolean;
    categoryId?: number;
    newCategoryName?: string;
  },
) {
  const currency = await upsertProductCurrencyId(data.price.currencyCode);
  const category = await getOrCreateCategory({
    categoryId: data.categoryId,
    newCategoryName: data.newCategoryName,
  });

  const updated = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      inStock: data.inStock,
      active: data.active,
      price: Math.round(data.price.amount),
      currencyId: currency.id,
      categoryId: category.id,
    },
    include: { currency: true },
  });
  const resolvedCategory = await prisma.category.findUnique({
    where: { id: updated.categoryId },
  });
  return mapProductToDto({
    ...updated,
    categoryName: resolvedCategory?.name ?? "other",
  });
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: Money;
  inStock: number;
  active: boolean;
  currencyCode?: string;
  categoryId?: number;
  newCategoryName?: string;
}) {
  const currency = await upsertProductCurrencyId(data.price.currencyCode);
  const category = await getOrCreateCategory({
    categoryId: data.categoryId,
    newCategoryName: data.newCategoryName,
  });

  const created = await prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      inStock: data.inStock,
      active: data.active,
      price: Math.round(data.price.amount),
      currencyId: currency.id,
      categoryId: category.id,
    },
    include: { currency: true },
  });
  const resolvedCategory = await prisma.category.findUnique({
    where: { id: created.categoryId },
  });
  return mapProductToDto({
    ...created,
    categoryName: resolvedCategory?.name ?? "other",
  });
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

