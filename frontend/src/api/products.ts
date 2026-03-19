import { apiGet } from "./client";

export interface Product {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  inStock: number;
}

export function getProducts() {
  return apiGet<Product[]>("/products");
}

