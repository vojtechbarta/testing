const API_BASE_URL = "http://localhost:4000";

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

