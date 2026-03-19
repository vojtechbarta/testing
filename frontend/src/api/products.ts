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

export function getProducts() {
  return apiGet<Product[]>("/products");
}

