import { getCartSessionId } from "../lib/cartSession";

const DEFAULT_API_BASE = "http://localhost:4000";

/** Resolved API origin (no trailing slash). Set `VITE_API_BASE_URL` at build time for production. */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE
).replace(/\/$/, "");

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

