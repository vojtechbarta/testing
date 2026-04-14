import { describe, expect, it } from "vitest";
import { checkoutEmailLangForFault } from "./checkout";

describe("checkoutEmailLangForFault", () => {
  it("keeps requested language when fault is off", () => {
    expect(checkoutEmailLangForFault("cs", false)).toBe("cs");
    expect(checkoutEmailLangForFault("en", false)).toBe("en");
  });

  it("flips language when fault is on", () => {
    expect(checkoutEmailLangForFault("cs", true)).toBe("en");
    expect(checkoutEmailLangForFault("en", true)).toBe("cs");
  });
});
