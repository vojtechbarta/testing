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

function toStorefrontRow(
  p: Parameters<typeof mapProductToDto>[0],
  lang: StorefrontLang,
  eurPerCzk: number | null,
): ProductDto {
  const base = mapProductToDto(p);
  const name = storefrontProductName(base.id, base.name, lang);
  const description = storefrontProductDescription(
    base.id,
    base.description,
    lang,
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

  const where = productListingWhere(params.searchQuery);

  const rows = await prisma.product.findMany({
    where,
    include: { currency: true },
  });

  const eurPerCzk = await loadEurPerCzkRate();
  const displayRows: ProductDto[] = rows.map((row) =>
    toStorefrontRow(row, params.lang, eurPerCzk),
  );

  if (displayRows.length === 0) {
    return {
      products: [],
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

  return { products, priceBounds };
}

export function parseStorefrontCatalogQuery(req: {
  query: Record<string, unknown>;
}): {
  q?: string;
  lang: StorefrontLang;
  sort: ShopSort;
  priceMin?: number;
  priceMax?: number;
} {
  const qRaw = req.query.q;
  const q =
    typeof qRaw === "string" && qRaw.trim() !== "" ? qRaw.trim() : undefined;

  const lang: StorefrontLang =
    req.query.lang === "cs" ? "cs" : "en";

  const sort = parseShopSort(req.query.sort);

  const priceMin = parseOptionalPriceParam(req.query.priceMin);
  const priceMax = parseOptionalPriceParam(req.query.priceMax);

  const out: {
    q?: string;
    lang: StorefrontLang;
    sort: ShopSort;
    priceMin?: number;
    priceMax?: number;
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
  return out;
}
