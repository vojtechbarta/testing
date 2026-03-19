import prisma from "../db/prisma";

export async function getAllFaultConfigs() {
  return prisma.faultConfig.findMany({
    orderBy: { key: "asc" },
  });
}

export async function upsertFaultConfig(key: string, data: {
  enabled?: boolean;
  latencyMs?: number | null;
  failureRate?: number | null;
}) {
  return prisma.faultConfig.upsert({
    where: { key },
    update: {
      enabled: data.enabled ?? false,
      latencyMs: data.latencyMs ?? null,
      failureRate: data.failureRate ?? null,
    },
    create: {
      key,
      enabled: data.enabled ?? false,
      latencyMs: data.latencyMs ?? null,
      failureRate: data.failureRate ?? null,
    },
  });
}

