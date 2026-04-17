import { test, expect } from "@playwright/test";
import { ShopPage, SEED_PRODUCTS } from "../pages/shop.page";

test.describe("Checkout and cart — error/boundary flows", () => {
  test("buyer step validates required checkout fields", async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    await shop.addToCart(SEED_PRODUCTS[0]!.name);

    await page.getByRole("button", { name: "Proceed to checkout" }).click();
    await page.getByRole("button", { name: "Continue to payment" }).click();

    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("First name is required")).toBeVisible();
    await expect(page.getByText("Last name is required")).toBeVisible();
    await expect(page.getByText("Phone is required")).toBeVisible();
  });

  test("cart increase is blocked when product reaches stock ceiling", async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    const product = SEED_PRODUCTS[0]!;
    await shop.addToCart(product.name);

    const line = shop.cartLineForProduct(product.name);
    const plus = line.getByRole("button", { name: "Increase quantity" });
    for (let i = 0; i < 30; i += 1) {
      if (!(await plus.isEnabled())) break;
      try {
        await plus.click({ timeout: 1500 });
      } catch {
        break;
      }
    }

    await expect(plus).toBeDisabled();
  });
});
