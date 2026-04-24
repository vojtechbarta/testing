import prisma from "../db/prisma";
import { FAULT_KEYS, isFaultEnabled } from "../faults/faultRuntime";
import { getFaultSettings, isFaultEnabled as isStaticFaultEnabled } from "../faults/faultService";
import {
  applySortUiFaultSwap,
  sortStorefrontProducts,
  type ShopSort,
} from "../shop/catalogSortFaults";
import { storefrontProductDescription, storefrontProductName } from "../shop/storefrontProductText";
import { loadEurPerCzkRate, toStorefrontMoney, type StorefrontLang } from "../shop/storefrontMoney";
import { mapProductToDto, productListingWhere, type ProductDto } from "./productService";

export type StorefrontCatalogResponse = {
  products: ProductDto[];
  categoryOptions: string[];
  priceBounds: { min: number; max: number; currencyCode: string };
};

function parseShopSort(raw: unknown): ShopSort {
  const s = typeof raw === "string" ? raw : "";
  if (
    s === "name-asc" ||
    s === "name-desc" ||
    s === "price-asc" ||
    s === "price-desc"
  ) {
    return s;
  }
  return "name-asc";
}

function parseOptionalPriceParam(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalCategory(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseOptionalCategories(raw: unknown): string[] | undefined {
  if (typeof raw !== "string") return undefined;
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return parsed.length > 0 ? [...new Set(parsed)] : undefined;
}

function toStorefrontRow(
  p: Parameters<typeof mapProductToDto>[0] & {
    translations?: Array<{ locale: string; name: string; description: string }>;
  },
  lang: StorefrontLang,
  eurPerCzk: number | null,
): ProductDto {
  const base = mapProductToDto(p);
  const name = storefrontProductName(base.id, base.name, lang, p.translations);
  const description = storefrontProductDescription(
    base.id,
    base.description,
    lang,
    p.translations,
  );
  const price = toStorefrontMoney(
    base.price.amount,
    base.price.currencyCode,
    lang,
    eurPerCzk,
  );
  return {
    ...base,
    name,
    description,
    price,
  };
}

export async function getStorefrontCatalog(params: {
  searchQuery?: string;
  lang: StorefrontLang;
  sort: ShopSort;
  priceMin?: number;
  priceMax?: number;
  category?: string;
  categories?: string[];
}): Promise<StorefrontCatalogResponse> {
  if (await isFaultEnabled(FAULT_KEYS.apiProductsOddMinuteDelay)) {
    const now = new Date();
    const currentMinute = now.getMinutes();
    // Only delay on odd minutes; even minutes behave normally.
    if (currentMinute % 2 === 1) {
      const seconds = now.getSeconds();
      const millis = now.getMilliseconds();
      const elapsedMs = seconds * 1000 + millis;
      const minuteMs = 60_000;
      const remainingMs = minuteMs - elapsedMs;
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }
    }
  }

  if (isStaticFaultEnabled("productListing_latency")) {
    const settings = getFaultSettings("productListing_latency");
    const latency = settings?.latencyMs ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  const where = productListingWhere(params.searchQuery, params.lang);
  const parsedSingleCategory = params.category?.trim();
  const parsedMultiCategories = params.categories
    ?.map((c) => c.trim())
    .filter((c) => c.length > 0);
  const categoryNames = [
    ...(parsedSingleCategory ? [parsedSingleCategory] : []),
    ...(parsedMultiCategories ?? []),
  ];
  if (categoryNames.length > 0) {
    const categories = await prisma.category.findMany({
      where: { name: { in: [...new Set(categoryNames)] } },
      select: { id: true },
    });
    const categoryIds = categories.map((category) => category.id);
    if (categoryIds.length === 0) {
      return {
        products: [],
        categoryOptions: [],
        priceBounds: { min: 0, max: 0, currencyCode: params.lang === "cs" ? "CZK" : "EUR" },
      };
    }
    where.categoryId = { in: categoryIds };
  }

  const rows = await prisma.product.findMany({
    where,
    include: { currency: true, translations: true },
  });
  const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const categoryOptions = [...new Set(categories.map((category) => category.name))].sort((a, b) =>
    a.localeCompare(b),
  );

  const eurPerCzk = await loadEurPerCzkRate();
  const displayRows: ProductDto[] = rows.map((row) =>
    toStorefrontRow(
      {
        ...row,
        categoryName: categoryMap.get(row.categoryId) ?? "other",
      },
      params.lang,
      eurPerCzk,
    ),
  );

  if (displayRows.length === 0) {
    return {
      products: [],
      categoryOptions,
      priceBounds: { min: 0, max: 0, currencyCode: params.lang === "cs" ? "CZK" : "EUR" },
    };
  }

  const amounts = displayRows.map((r) => r.price.amount);
  const currencyCode = displayRows[0]!.price.currencyCode;
  const priceBounds = {
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    currencyCode,
  };

  let filtered = displayRows;
  const { priceMin, priceMax } = params;
  if (
    priceMin !== undefined &&
    priceMax !== undefined &&
    Number.isFinite(priceMin) &&
    Number.isFinite(priceMax)
  ) {
    const lo = Math.min(priceMin, priceMax);
    const hi = Math.max(priceMin, priceMax);
    filtered = displayRows.filter(
      (r) => r.price.amount >= lo && r.price.amount <= hi,
    );
  }

  const sorted = sortStorefrontProducts(filtered, params.sort, params.lang);

  const faultKeys = new Set<string>();
  if (await isFaultEnabled(FAULT_KEYS.apiSortPriceAscSwapLastTwo)) {
    faultKeys.add("sort_price_asc_swap_last_two");
  }
  if (await isFaultEnabled(FAULT_KEYS.apiSortNameDescSwapLastTwo)) {
    faultKeys.add("sort_name_desc_swap_last_two");
  }

  const products = applySortUiFaultSwap(sorted, params.sort, faultKeys);

  return { products, categoryOptions, priceBounds };
}

export function parseStorefrontCatalogQuery(req: {
  query: Record<string, unknown>;
}): {
  q?: string;
  lang: StorefrontLang;
  sort: ShopSort;
  priceMin?: number;
  priceMax?: number;
  category?: string;
  categories?: string[];
} {
  const qRaw = req.query.q;
  const q =
    typeof qRaw === "string" && qRaw.trim() !== "" ? qRaw.trim() : undefined;

  const lang: StorefrontLang =
    req.query.lang === "cs" ? "cs" : "en";

  const sort = parseShopSort(req.query.sort);

  const priceMin = parseOptionalPriceParam(req.query.priceMin);
  const priceMax = parseOptionalPriceParam(req.query.priceMax);
  const category = parseOptionalCategory(req.query.category);
  const categories = parseOptionalCategories(req.query.categories);

  const out: {
    q?: string;
    lang: StorefrontLang;
    sort: ShopSort;
    priceMin?: number;
    priceMax?: number;
    category?: string;
    categories?: string[];
  } = { lang, sort };
  if (q !== undefined) {
    out.q = q;
  }
  if (priceMin !== undefined) {
    out.priceMin = priceMin;
  }
  if (priceMax !== undefined) {
    out.priceMax = priceMax;
  }
  if (category !== undefined) {
    out.category = category;
  }
  if (categories !== undefined) {
    out.categories = categories;
  }
  return out;
}
