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

export function getProducts(searchQuery?: string) {
  const q = searchQuery?.trim();
  const suffix = q ? `?${new URLSearchParams({ q }).toString()}` : "";
  return apiGet<Product[]>(`/products${suffix}`);
}

