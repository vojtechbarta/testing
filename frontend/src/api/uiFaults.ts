const API_BASE_URL = "http://localhost:4000";

export async function getActiveUiFaultKeys(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/faults/ui`);
  if (!res.ok) {
    throw new Error(`Failed to load active UI faults (${res.status})`);
  }
  const data = (await res.json()) as { keys?: string[] };
  return data.keys ?? [];
}

