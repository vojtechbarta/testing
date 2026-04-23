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
    test.slow();
    const shop = new ShopPage(page);
    await shop.goto();
    const product = SEED_PRODUCTS[0]!;
    await shop.addToCart(product.name);

    const line = shop.cartLineForProduct(product.name);
    const plus = line.getByRole("button", { name: "Increase quantity" });
    const qty = line.locator(".cart-qty-label");
    const stockLabel = line.locator(".cart-qty-stock");
    await expect(plus).toBeEnabled({ timeout: 15000 });

    for (let i = 0; i < 30; i += 1) {
      if (!(await plus.isEnabled())) break;
      const prevQty = Number(await qty.innerText());
      await Promise.all([
        page.waitForResponse(
          (res) =>
            res.request().method() === "POST" &&
            new URL(res.url()).pathname.endsWith("/cart/items"),
        ),
        plus.click(),
      ]);
      await expect
        .poll(async () => Number(await qty.innerText()), { timeout: 15000 })
        .toBeGreaterThanOrEqual(prevQty);
    }

    await expect(plus).toBeDisabled({ timeout: 15000 });
    const finalQty = Number(await qty.innerText());
    const stockText = await stockLabel.innerText();
    const stockMatch = stockText.match(/(\d+)/);
    expect(stockMatch, `Expected stock label to contain a number, got "${stockText}"`).not.toBeNull();
    const finalStock = Number(stockMatch![1]);
    expect(finalQty).toBe(finalStock);
  });
});
