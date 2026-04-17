import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    faultConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

import { getAllFaultConfigs, upsertFaultConfig } from "../faultAdminService";

describe("faultAdminService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllFaultConfigs orders by key ascending", async () => {
    mockPrisma.faultConfig.findMany.mockResolvedValue([{ key: "a" }]);

    const rows = await getAllFaultConfigs();

    expect(mockPrisma.faultConfig.findMany).toHaveBeenCalledWith({
      orderBy: { key: "asc" },
    });
    expect(rows).toEqual([{ key: "a" }]);
  });

  it("creates config when key does not exist", async () => {
    mockPrisma.faultConfig.findUnique.mockResolvedValue(null);
    mockPrisma.faultConfig.create.mockResolvedValue({ key: "new_key", enabled: true });

    const row = await upsertFaultConfig("new_key", { enabled: true, level: "API" });

    expect(mockPrisma.faultConfig.create).toHaveBeenCalled();
    expect(mockPrisma.faultConfig.upsert).not.toHaveBeenCalled();
    expect(row).toMatchObject({ key: "new_key", enabled: true });
  });

  it("create path uses fallback defaults for missing optional metadata", async () => {
    mockPrisma.faultConfig.findUnique.mockResolvedValue(null);
    mockPrisma.faultConfig.create.mockResolvedValue({ key: "fallback_key", enabled: false });

    await upsertFaultConfig("fallback_key", {});

    expect(mockPrisma.faultConfig.create).toHaveBeenCalledWith({
      data: {
        key: "fallback_key",
        enabled: false,
        latencyMs: null,
        failureRate: null,
        name: "fallback_key",
        description: "",
        level: "UI",
      },
    });
  });

  it("upserts when key already exists", async () => {
    mockPrisma.faultConfig.findUnique.mockResolvedValue({ key: "k", enabled: false });
    mockPrisma.faultConfig.upsert.mockResolvedValue({ key: "k", enabled: true });

    const row = await upsertFaultConfig("k", { enabled: true });

    expect(mockPrisma.faultConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "k" },
        update: expect.objectContaining({ enabled: true }),
      }),
    );
    expect(row).toMatchObject({ key: "k", enabled: true });
  });

  it("existing row keeps prior enabled flag when enabled is undefined", async () => {
    mockPrisma.faultConfig.findUnique.mockResolvedValue({ key: "k2", enabled: true });
    mockPrisma.faultConfig.upsert.mockResolvedValue({ key: "k2", enabled: true });

    await upsertFaultConfig("k2", { name: "New Name" });

    expect(mockPrisma.faultConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "k2" },
        update: expect.objectContaining({ enabled: true, name: "New Name" }),
      }),
    );
  });

  it("update payload includes only explicitly defined optional fields", async () => {
    mockPrisma.faultConfig.findUnique.mockResolvedValue({ key: "k3", enabled: false });
    mockPrisma.faultConfig.upsert.mockResolvedValue({ key: "k3", enabled: false });

    await upsertFaultConfig("k3", {
      description: "desc",
      latencyMs: 250,
      failureRate: 0.5,
      level: "API",
    });

    const call = mockPrisma.faultConfig.upsert.mock.calls[0]?.[0];
    expect(call.update).toMatchObject({
      enabled: false,
      description: "desc",
      latencyMs: 250,
      failureRate: 0.5,
      level: "API",
    });
    expect(call.update.name).toBeUndefined();
  });
});
