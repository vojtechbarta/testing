import { test, expect } from "@playwright/test";

test.describe("I18N — language switch", () => {
  test("switches EN/CS labels from top navigation", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Shop" })).toBeVisible();
    await page.getByTestId("lang-switch-cs").click();
    await expect(page.getByRole("button", { name: "Obchod" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Přihlášení" })).toBeVisible();

    await page.getByTestId("lang-switch-en").click();
    await expect(page.getByRole("button", { name: "Shop" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });
});
