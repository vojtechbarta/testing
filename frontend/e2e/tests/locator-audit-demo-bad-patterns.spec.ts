import { test, expect } from "@playwright/test";

/**
 * Intentionally bad Playwright locators for exercising the locator audit cycle
 * (see `frontend/e2e/README.md`). Do not copy these patterns.
 *
 * The whole describe is skipped so `npm run test:e2e` stays green; remove `.skip`
 * locally if you want to watch this fail or mis-click the wrong element.
 */
test.describe.skip("Locator audit demo — intentionally bad selectors", () => {
  test("anti-patterns only (deep CSS, xpath, ambiguous text)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // ! Unstable locator - deep layout chain; any wrapper change breaks the test
    await page.locator("main > div > div:nth-child(2) > button").click();

    // ! Unstable locator - bare text can match nav, footer, or multiple buttons
    await expect(page.getByText("Login")).toBeVisible();

    // ! Unstable locator - xpath + partial class is brittle and hard to maintain
    await page.locator("xpath=//*[contains(@class,'button')]").first().click();

    // ! Unstable locator - nth-of-type depends on sibling order, not semantics
    await page.locator("section .product-grid .product-card:nth-of-type(1) button").click();
  });
});
