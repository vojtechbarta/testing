import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";
import {
  getProductDisplayDescription,
  getProductDisplayName,
} from "./productDisplay";

describe("getProductDisplayName", () => {
  it("returns translation when key resolves", () => {
    const t = vi.fn((key: string, opts?: { defaultValue?: string }) =>
      key === "products.byId.1" ? "Bezdrátová myš M200" : opts?.defaultValue ?? key,
    ) as unknown as TFunction;
    expect(
      getProductDisplayName(t, { id: 1, name: "Wireless Mouse M200" }),
    ).toBe("Bezdrátová myš M200");
  });

  it("falls back to API name when no translation", () => {
    const t = vi.fn((_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? "fallback",
    ) as unknown as TFunction;
    expect(
      getProductDisplayName(t, { id: 999, name: "Custom Product" }),
    ).toBe("Custom Product");
  });
});

describe("getProductDisplayDescription", () => {
  it("returns translation when key resolves", () => {
    const t = vi.fn((key: string, opts?: { defaultValue?: string }) =>
      key === "products.descById.1"
        ? "Spolehlivá bezdrátová myš…"
        : (opts?.defaultValue ?? key),
    ) as unknown as TFunction;
    expect(
      getProductDisplayDescription(t, {
        id: 1,
        description: "Reliable wireless mouse for everyday office work.",
      }),
    ).toBe("Spolehlivá bezdrátová myš…");
  });

  it("falls back to API description when no translation", () => {
    const t = vi.fn((_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? "fallback",
    ) as unknown as TFunction;
    expect(
      getProductDisplayDescription(t, {
        id: 999,
        description: "Custom desc",
      }),
    ).toBe("Custom desc");
  });
});
