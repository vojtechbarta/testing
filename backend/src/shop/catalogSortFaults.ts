import type { ProductDto } from "../services/productService";

export type ShopSort =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc";

export function sortStorefrontProducts(
  products: ProductDto[],
  shopSort: ShopSort,
  lang: "en" | "cs",
): ProductDto[] {
  const sorted = [...products];
  const collator = lang === "cs" ? "cs" : "en";
  sorted.sort((a, b) => {
    if (shopSort === "name-asc") {
      return a.name.localeCompare(b.name, collator);
    }
    if (shopSort === "name-desc") {
      return b.name.localeCompare(a.name, collator);
    }
    if (shopSort === "price-asc") {
      return a.price.amount - b.price.amount;
    }
    return b.price.amount - a.price.amount;
  });
  return sorted;
}

/** UI-level fault: swap last two rows after sort (parity with former frontend `shopCatalog.ts`). */
export function applySortUiFaultSwap(
  sorted: ProductDto[],
  shopSort: ShopSort,
  activeFaultKeys: ReadonlySet<string>,
): ProductDto[] {
  const swapLastTwo = sorted.length >= 2;
  const priceAscFault = activeFaultKeys.has("sort_price_asc_swap_last_two");
  const nameDescFault = activeFaultKeys.has("sort_name_desc_swap_last_two");

  if (
    swapLastTwo &&
    ((shopSort === "price-asc" && priceAscFault) ||
      (shopSort === "name-desc" && nameDescFault))
  ) {
    const out = [...sorted];
    const i = out.length - 2;
    const j = out.length - 1;
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) {
      return sorted;
    }
    out[i] = b;
    out[j] = a;
    return out;
  }

  return sorted;
}
