import { API_BASE_URL } from "./client";

export async function getActiveUiFaultConfigs(): Promise<
  Array<{ key: string; failureRate: number }>
> {
  const res = await fetch(`${API_BASE_URL}/faults/ui`);
  if (!res.ok) {
    throw new Error(`Failed to load active UI faults (${res.status})`);
  }
  const data = (await res.json()) as { faults?: Array<{ key: string; failureRate: number }> };
  return data.faults ?? [];
}

export async function callInjectErrorEndpoint(lang: string): Promise<void> {
  const l = lang.startsWith("cs") ? "cs" : "en";
  await fetch(`${API_BASE_URL}/faults/inject-error?lang=${encodeURIComponent(l)}`);
}

