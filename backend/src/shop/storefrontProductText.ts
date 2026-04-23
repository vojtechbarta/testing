import { CZECH_PRODUCT_DESC_BY_ID, CZECH_PRODUCT_NAME_BY_ID } from "./czechProductCopy";
import type { StorefrontLang } from "./storefrontMoney";

type ProductLocaleTranslation = {
  locale: string;
  name: string;
  description: string;
};

function resolveCzechTranslation(
  id: number,
  translations: ProductLocaleTranslation[] | undefined,
): ProductLocaleTranslation | null {
  const dbTranslation = translations?.find((row) => row.locale === "cs");
  if (dbTranslation) {
    return dbTranslation;
  }
  const fallbackName = CZECH_PRODUCT_NAME_BY_ID[id];
  const fallbackDescription = CZECH_PRODUCT_DESC_BY_ID[id];
  if (!fallbackName || !fallbackDescription) {
    return null;
  }
  return {
    locale: "cs",
    name: fallbackName,
    description: fallbackDescription,
  };
}

export function storefrontProductName(
  id: number,
  dbName: string,
  lang: StorefrontLang,
  translations?: ProductLocaleTranslation[],
): string {
  if (lang === "cs") {
    return resolveCzechTranslation(id, translations)?.name ?? dbName;
  }
  return dbName;
}

export function storefrontProductDescription(
  id: number,
  dbDescription: string,
  lang: StorefrontLang,
  translations?: ProductLocaleTranslation[],
): string {
  if (lang === "cs") {
    return resolveCzechTranslation(id, translations)?.description ?? dbDescription;
  }
  return dbDescription;
}
