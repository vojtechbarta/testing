import { apiGet, cartSessionHeaders } from "./client";

export interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  inStock: number;
  price: {
    amount: number;
    currencyCode: string;
  };
  lineTotal: {
    amount: number;
    currencyCode: string;
  };
}

export interface Cart {
  cartSessionId: string;
  items: CartItem[];
  total: {
    amount: number;
    currencyCode: string;
  };
}

export async function getCart(): Promise<Cart> {
  return apiGet<Cart>("/cart");
}

export async function updateCartItem(
  productId: number,
  quantity: number,
): Promise<Cart> {
  const res = await fetch("http://localhost:4000/cart/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...cartSessionHeaders(),
    },
    body: JSON.stringify({ productId, quantity }),
  });

  if (!res.ok) {
    let message = `Cart update failed with status ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // no-op, fallback to generic message
    }
    throw new Error(message);
  }

  return res.json();
}

