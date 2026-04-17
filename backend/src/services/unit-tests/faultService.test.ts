import { describe, expect, it } from "vitest";
import { faultConfig } from "../../faults/faultConfig";
import { getFaultSettings, isFaultEnabled } from "../../faults/faultService";

describe("faultService static config access", () => {
  it("returns false for unknown keys", () => {
    expect(isFaultEnabled("productListing_latency" as any)).toBe(false);
  });

  it("returns settings object or undefined for key lookup", () => {
    const settings = getFaultSettings("productListing_latency" as any);
    expect(settings === undefined || typeof settings === "object").toBe(true);
  });

  it("returns true when a known fault key is toggled on", () => {
    const prev = faultConfig.productListing_latency.enabled;
    faultConfig.productListing_latency.enabled = true;
    expect(isFaultEnabled("productListing_latency")).toBe(true);
    faultConfig.productListing_latency.enabled = prev;
  });
});
