import { CZECH_PRODUCT_DESC_BY_ID, CZECH_PRODUCT_NAME_BY_ID } from "./czechProductCopy";
import type { StorefrontLang } from "./storefrontMoney";

export function storefrontProductName(
  id: number,
  dbName: string,
  lang: StorefrontLang,
): string {
  if (lang === "cs") {
    return CZECH_PRODUCT_NAME_BY_ID[id] ?? dbName;
  }
  return dbName;
}

export function storefrontProductDescription(
  id: number,
  dbDescription: string,
  lang: StorefrontLang,
): string {
  if (lang === "cs") {
    return CZECH_PRODUCT_DESC_BY_ID[id] ?? dbDescription;
  }
  return dbDescription;
}
