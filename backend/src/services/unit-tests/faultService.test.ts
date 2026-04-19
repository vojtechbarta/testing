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

  it("reflects cart_price_miscalculation toggle", () => {
    const prev = faultConfig.cart_price_miscalculation.enabled;
    faultConfig.cart_price_miscalculation.enabled = true;
    expect(isFaultEnabled("cart_price_miscalculation")).toBe(true);
    faultConfig.cart_price_miscalculation.enabled = false;
    expect(isFaultEnabled("cart_price_miscalculation")).toBe(false);
    faultConfig.cart_price_miscalculation.enabled = prev;
  });

  it("returns settings for cart_price_miscalculation", () => {
    expect(getFaultSettings("cart_price_miscalculation")).toEqual(
      faultConfig.cart_price_miscalculation,
    );
  });
});
