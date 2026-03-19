const API_BASE_URL = "http://localhost:4000";

export interface AdminFault {
  key: string;
  name: string;
  description: string;
  level: "UI" | "API" | "Unit";
  enabled: boolean;
  latencyMs: number | null;
  failureRate: number | null;
}

export async function getAdminFaults(token: string): Promise<AdminFault[]> {
  const res = await fetch(`${API_BASE_URL}/admin/faults`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load faults (${res.status})`);
  }

  return res.json();
}

export async function updateAdminFault(
  token: string,
  key: string,
  data: Partial<
    Pick<AdminFault, "enabled" | "latencyMs" | "failureRate" | "name" | "description" | "level">
  >,
): Promise<AdminFault> {
  const res = await fetch(`${API_BASE_URL}/admin/faults/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to update fault (${res.status})`);
  }

  return res.json();
}

