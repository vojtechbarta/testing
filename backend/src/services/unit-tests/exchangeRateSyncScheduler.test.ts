import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncDailyCnbExchangeRatesMock } = vi.hoisted(() => ({
  syncDailyCnbExchangeRatesMock: vi.fn(),
}));

vi.mock("../cnbExchangeRateSyncService", () => ({
  syncDailyCnbExchangeRates: syncDailyCnbExchangeRatesMock,
}));

import {
  getExchangeRateSyncStatus,
  resetExchangeRateSyncSchedulerForTests,
  startExchangeRateSyncScheduler,
} from "../exchangeRateSyncScheduler";

describe("exchangeRateSyncScheduler", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFxSyncEnabled = process.env.FX_SYNC_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    resetExchangeRateSyncSchedulerForTests();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.FX_SYNC_ENABLED = originalFxSyncEnabled;
  });

  afterEach(() => {
    resetExchangeRateSyncSchedulerForTests();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.FX_SYNC_ENABLED = originalFxSyncEnabled;
  });

  it("returns default sync status before scheduler starts", () => {
    expect(getExchangeRateSyncStatus()).toEqual({
      lastSuccessfulSyncAt: null,
      lastImportedCount: 0,
      lastAttemptedLocalDate: null,
    });
  });

  it("does not start when NODE_ENV is test", () => {
    process.env.NODE_ENV = "test";
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    startExchangeRateSyncScheduler();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(syncDailyCnbExchangeRatesMock).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("does not start when FX_SYNC_ENABLED is false", () => {
    process.env.NODE_ENV = "development";
    process.env.FX_SYNC_ENABLED = "false";
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    startExchangeRateSyncScheduler();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("starts only one polling interval when enabled", () => {
    process.env.NODE_ENV = "development";
    delete process.env.FX_SYNC_ENABLED;
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    startExchangeRateSyncScheduler();
    startExchangeRateSyncScheduler();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });
});
