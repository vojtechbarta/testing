import { getCartSessionId } from "../lib/cartSession";

const DEFAULT_API_BASE = "http://localhost:4000";

/**
 * API origin (no trailing slash).
 * - Dev + no `VITE_API_BASE_URL`: use same origin as the Vite app; `vite.config` proxies API paths to :4000 (no CORS).
 * - Production / explicit `VITE_API_BASE_URL`: full URL to the backend.
 */
export const API_BASE_URL = (() => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "";
  }
  return DEFAULT_API_BASE.replace(/\/$/, "");
})();

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

