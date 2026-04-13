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
  return apiGet<StorefrontCatalogResponse>(`/products?${sp.toString()}`);
}
