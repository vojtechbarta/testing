const STORAGE_KEY = "cartSessionId";

/**
 * Per-tab cart session (sessionStorage). Each browser tab / Playwright context gets its own empty cart.
 */
export function getCartSessionId(): string {
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
