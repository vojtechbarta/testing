import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMockPaymentOutcomeForEmail } from "../mockPaymentConfigService";

/** Tests PaymentConfigs.json resolution: file I/O is stubbed so tests do not depend on disk or cwd. */
describe("mockPaymentConfigService", () => {
  let readSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    readSpy = vi.spyOn(fs, "readFileSync");
  });

  afterEach(() => {
    readSpy.mockRestore();
  });

  // Blank buyer email short-circuits to success and skips reading PaymentConfigs.json entirely.
  it("returns success when buyer email is empty (does not read file)", () => {
    expect(loadMockPaymentOutcomeForEmail("   ")).toBe("success");
    expect(readSpy).not.toHaveBeenCalled();
  });

  // JSON keys and lookup email are compared in lowercase so FAIL@ and fail@ resolve to the same rule.
  it("maps byBuyerEmail case-insensitively", () => {
    readSpy.mockReturnValue(
      JSON.stringify({
        byBuyerEmail: { "FAIL@EXAMPLE.COM": "failure" },
      }),
    );
    expect(loadMockPaymentOutcomeForEmail("fail@example.com")).toBe("failure");
    expect(readSpy).toHaveBeenCalled();
  });

  // Default policy: if the buyer’s email has no entry, mock payment behaves like success (allows checkout E2E without config edits).
  it("returns success when email is not listed", () => {
    readSpy.mockReturnValue(
      JSON.stringify({ byBuyerEmail: { "other@x.com": "failure" } }),
    );
    expect(loadMockPaymentOutcomeForEmail("me@shop.com")).toBe("success");
  });

  // Explicit "random" in config is preserved so the gateway can apply a 50/50 roll later.
  it("returns random when configured", () => {
    readSpy.mockReturnValue(
      JSON.stringify({ byBuyerEmail: { "rnd@test.com": "random" } }),
    );
    expect(loadMockPaymentOutcomeForEmail("rnd@test.com")).toBe("random");
  });

  it("returns success when readFileSync throws", () => {
    readSpy.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(loadMockPaymentOutcomeForEmail("any@x.com")).toBe("success");
  });

  // Typos or unsupported strings in JSON normalize to success so a bad config line does not hard-fail payments.
  it("treats unknown outcome values as success", () => {
    readSpy.mockReturnValue(
      JSON.stringify({ byBuyerEmail: { "x@y.com": "garbage" } }),
    );
    expect(loadMockPaymentOutcomeForEmail("x@y.com")).toBe("success");
  });

  // Empty / partial JSON without byBuyerEmail still yields the default success behaviour.
  it("returns success when byBuyerEmail is missing", () => {
    readSpy.mockReturnValue(JSON.stringify({}));
    expect(loadMockPaymentOutcomeForEmail("x@y.com")).toBe("success");
  });
});
