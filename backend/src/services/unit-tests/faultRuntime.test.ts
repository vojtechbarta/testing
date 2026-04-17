import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    faultConfig: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

import {
  invalidateFaultRuntimeCache,
  isFaultEnabled,
  listEnabledUiFaultConfigs,
  shouldTriggerFault,
} from "../../faults/faultRuntime";

describe("faultRuntime cache and trigger behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateFaultRuntimeCache();
  });

  it("returns false for unknown fault key", async () => {
    mockPrisma.faultConfig.findMany.mockResolvedValue([]);
    await expect(isFaultEnabled("missing")).resolves.toBe(false);
  });

  it("handles enabled fault without failureRate as always true trigger", async () => {
    mockPrisma.faultConfig.findMany.mockResolvedValue([
      { key: "k", enabled: true, level: "API", failureRate: null },
    ]);
    await expect(shouldTriggerFault("k")).resolves.toBe(true);
  });

  it("uses clamped failureRate with random comparison", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);
    mockPrisma.faultConfig.findMany.mockResolvedValue([
      { key: "k2", enabled: true, level: "API", failureRate: 0.2 },
    ]);
    await expect(shouldTriggerFault("k2")).resolves.toBe(false);
    randomSpy.mockRestore();
  });

  it("clamps negative failureRate to 0 (never triggers)", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    mockPrisma.faultConfig.findMany.mockResolvedValue([
      { key: "k3", enabled: true, level: "API", failureRate: -5 },
    ]);
    await expect(shouldTriggerFault("k3")).resolves.toBe(false);
    randomSpy.mockRestore();
  });

  it("returns false when fault exists but is disabled", async () => {
    mockPrisma.faultConfig.findMany.mockResolvedValue([
      { key: "k4", enabled: false, level: "API", failureRate: 1 },
    ]);
    await expect(shouldTriggerFault("k4")).resolves.toBe(false);
  });

  it("lists only enabled UI faults with normalized failureRate", async () => {
    mockPrisma.faultConfig.findMany.mockResolvedValue([
      { key: "uiA", enabled: true, level: "UI", failureRate: null },
      { key: "uiB", enabled: true, level: "UI", failureRate: 2 },
      { key: "apiX", enabled: true, level: "API", failureRate: 0.5 },
    ]);
    const rows = await listEnabledUiFaultConfigs();
    expect(rows).toEqual([
      { key: "uiA", failureRate: 1 },
      { key: "uiB", failureRate: 1 },
    ]);
  });
});
