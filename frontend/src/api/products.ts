import { apiGet } from "./client";

export interface Product {
  id: number;
  name: string;
  description: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  inStock: number;
  active: boolean;
}

export type ShopSort =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc";

export type StorefrontCatalogResponse = {
  products: Product[];
  priceBounds: { min: number; max: number; currencyCode: string };
};

function computeFallbackPriceBounds(products: Product[]): {
  min: number;
  max: number;
  currencyCode: string;
} {
  if (products.length === 0) {
    return { min: 0, max: 0, currencyCode: "CZK" };
  }
  const amounts = products.map((p) => p.price.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const currencyCode = products[0].price.currencyCode || "CZK";
  return { min, max, currencyCode };
}

function normalizeCatalogResponse(raw: unknown): StorefrontCatalogResponse {
  const asRecord =
    raw !== null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : null;
  const products = Array.isArray(asRecord?.products)
    ? (asRecord.products as Product[])
    : [];

  const pb =
    asRecord?.priceBounds !== null &&
    typeof asRecord?.priceBounds === "object"
      ? (asRecord.priceBounds as Record<string, unknown>)
      : null;
  const hasValidPriceBounds =
    pb !== null &&
    typeof pb.min === "number" &&
    typeof pb.max === "number" &&
    typeof pb.currencyCode === "string";

  return {
    products,
    priceBounds: hasValidPriceBounds
      ? {
          min: pb.min as number,
          max: pb.max as number,
          currencyCode: pb.currencyCode as string,
        }
      : computeFallbackPriceBounds(products),
  };
}

/** Storefront catalog: search, locale, sort, price range, and display money are applied on the server. */
export async function getStorefrontProducts(params: {
  q?: string;
  lang: "en" | "cs";
  sort: ShopSort;
  priceMin?: number;
  priceMax?: number;
}): Promise<StorefrontCatalogResponse> {
  const sp = new URLSearchParams();
  sp.set("lang", params.lang);
  sp.set("sort", params.sort);
  if (params.q) {
    sp.set("q", params.q);
  }
  if (params.priceMin !== undefined) {
    sp.set("priceMin", String(params.priceMin));
  }
  if (params.priceMax !== undefined) {
    sp.set("priceMax", String(params.priceMax));
  }
  const raw = await apiGet<unknown>(`/products?${sp.toString()}`);
  return normalizeCatalogResponse(raw);
}
