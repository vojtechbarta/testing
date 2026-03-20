import { getCartSessionId } from "../lib/cartSession";

const API_BASE_URL = "http://localhost:4000";

export function cartSessionHeaders(): HeadersInit {
  return { "X-Cart-Session": getCartSessionId() };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: cartSessionHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
}

