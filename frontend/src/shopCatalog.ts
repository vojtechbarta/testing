/**
 * Pure helpers for shop grid: price filter, client-side sort, optional UI fault swap.
 * Kept out of `App.tsx` for unit testing (API search/sort lives elsewhere).
 */

export type ShopSort =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc";

export type ShopCatalogProduct = {
  name: string;
  price: { amount: number };
};

export function filterProductsByPriceRange<T extends ShopCatalogProduct>(
  products: T[],
  min: number,
  max: number,
): T[] {
  return products.filter(
    (p) => p.price.amount >= min && p.price.amount <= max,
  );
}

export function sortShopProducts<T extends ShopCatalogProduct>(
  products: T[],
  shopSort: ShopSort,
): T[] {
  const sorted = [...products];
  sorted.sort((a, b) => {
    if (shopSort === "name-asc") return a.name.localeCompare(b.name, "cs");
    if (shopSort === "name-desc") return b.name.localeCompare(a.name, "cs");
    if (shopSort === "price-asc") return a.price.amount - b.price.amount;
    return b.price.amount - a.price.amount;
  });
  return sorted;
}

/** Matches fault keys that intentionally permute the last two rows when sort is active. */
export function applySortUiFaultSwap<T>(
  sorted: T[],
  shopSort: ShopSort,
  activeFaultKeys: readonly string[],
): T[] {
  const keys = new Set(activeFaultKeys);
  const swapLastTwo = sorted.length >= 2;
  const priceAscFault = keys.has("sort_price_asc_swap_last_two");
  const nameDescFault = keys.has("sort_name_desc_swap_last_two");

  if (
    swapLastTwo &&
    ((shopSort === "price-asc" && priceAscFault) ||
      (shopSort === "name-desc" && nameDescFault))
  ) {
    const out = [...sorted];
    const last = out.length - 1;
    [out[last - 1], out[last]] = [out[last], out[last - 1]];
    return out;
  }

  return sorted;
}

export function getVisibleShopProducts<T extends ShopCatalogProduct>(
  products: T[],
  priceFilter: { min: number; max: number },
  shopSort: ShopSort,
  activeUiFaultKeys: readonly string[],
): T[] {
  const filtered = filterProductsByPriceRange(
    products,
    priceFilter.min,
    priceFilter.max,
  );
  const sorted = sortShopProducts(filtered, shopSort);
  return applySortUiFaultSwap(sorted, shopSort, activeUiFaultKeys);
}
