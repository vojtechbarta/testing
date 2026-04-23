import { test, expect } from "@playwright/test";
import { ShopPage, SEED_PRODUCTS } from "../pages/shop.page";

async function fillBuyerRequiredFields(page: import("@playwright/test").Page) {
  const email = `checkout-${Date.now()}@example.test`;
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="given-name"]').fill("Checkout");
  await page.locator('input[autocomplete="family-name"]').fill("Happy");
  await page.locator('input[autocomplete="tel"]').fill("+420123456789");
}

test.describe("Checkout — happy path", () => {
  test("@smoke bank transfer flow reaches dummy transfer details", async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();

    const mouse = SEED_PRODUCTS[0]!;
    await shop.addToCart(mouse.name);

    await page.getByRole("button", { name: "Proceed to checkout" }).click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    await fillBuyerRequiredFields(page);
    await page.getByRole("button", { name: "Continue to payment" }).click();

    await expect(page.getByRole("radio", { name: /Bank transfer/i })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Dummy transfer details")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("IBAN")).toBeVisible();
  });
});
