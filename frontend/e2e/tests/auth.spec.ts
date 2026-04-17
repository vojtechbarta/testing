import { test, expect } from "@playwright/test";

test.describe("Auth — login perspectives", () => {
  test("admin login succeeds and opens product management controls", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Login" }).click();
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("admin");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Add new product" })).toBeVisible();
  });

  test("tester login succeeds and only tester navigation is visible", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Login" }).click();
    await page.locator('input[name="username"]').fill("tester");
    await page.locator('input[name="password"]').fill("tester");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Bugs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);
  });

  test("login shows error for invalid credentials", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Login" }).click();
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".store-alert--error")).toContainText("Login failed");
  });
});
