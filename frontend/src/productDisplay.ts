import type { TFunction } from "i18next";

export function getProductDisplayName(
  t: TFunction,
  product: { id: number; name: string },
): string {
  return t(`products.byId.${product.id}`, { defaultValue: product.name });
}

export function getProductDisplayDescription(
  t: TFunction,
  product: { id: number; description: string },
): string {
  return t(`products.descById.${product.id}`, {
    defaultValue: product.description,
  });
}
