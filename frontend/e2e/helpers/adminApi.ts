import type { APIRequestContext } from "@playwright/test";

/** Must match `DEFAULT_API_BASE` in `frontend/src/api/client.ts` and running backend origin. */
export function apiBaseUrl(): string {
  return (process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:4000").replace(
    /\/$/,
    "",
  );
}

export async function loginAsAdmin(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${apiBaseUrl()}/auth/login`, {
    data: { username: "admin", password: "admin" },
  });
  if (!res.ok()) {
    throw new Error(`Admin login failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

export async function loginAsTester(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${apiBaseUrl()}/auth/login`, {
    data: { username: "tester", password: "tester" },
  });
  if (!res.ok()) {
    throw new Error(`Tester login failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

export async function deleteAdminProduct(
  request: APIRequestContext,
  token: string,
  productId: number,
): Promise<void> {
  const res = await request.delete(`${apiBaseUrl()}/admin/products/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`Delete product failed: ${res.status()} ${await res.text()}`);
  }
}
