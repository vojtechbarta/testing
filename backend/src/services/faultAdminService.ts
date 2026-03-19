import prisma from "../db/prisma";

export async function getAllFaultConfigs() {
  return prisma.faultConfig.findMany({
    orderBy: { key: "asc" },
  });
}

export async function upsertFaultConfig(key: string, data: {
  enabled?: boolean;
  name?: string;
  description?: string;
  level?: string;
  latencyMs?: number | null;
  failureRate?: number | null;
}) {
  // Upsert se bude používat hlavně pro zapnutí/vypnutí. Metadata
  // (name/description/level) můžou být doplněna později při tvorbě nové chyby.
  const existing = await prisma.faultConfig.findUnique({
    where: { key },
  });

  const createData = {
    key,
    enabled: data.enabled ?? false,
    latencyMs: data.latencyMs ?? null,
    failureRate: data.failureRate ?? null,
    name: data.name ?? key,
    description: data.description ?? "",
    level: (data.level ?? "UI") as any,
  };

  const updateData: any = {
    enabled: data.enabled ?? existing?.enabled ?? false,
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.level !== undefined) updateData.level = data.level;
  if (data.latencyMs !== undefined) updateData.latencyMs = data.latencyMs;
  if (data.failureRate !== undefined) updateData.failureRate = data.failureRate;

  if (!existing) {
    return prisma.faultConfig.create({ data: createData });
  }

  return prisma.faultConfig.upsert({
    where: { key },
    update: updateData,
    create: createData,
  });
}

