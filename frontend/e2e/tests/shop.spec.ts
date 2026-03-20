import { test, expect } from "@playwright/test";
import {
  ShopPage,
  SEED_PRODUCTS,
  formatCzk,
} from "../pages/shop.page";

test.describe("Shop — catalog and cart", () => {
  test("home shows three seed products; adding Test Mouse updates cart with correct totals", async ({
    page,
  }) => {
    const shop = new ShopPage(page);

    await shop.goto();
    await expect(
      page,
      "Browser tab title should be AI Testing Shop (see index.html <title>)",
    ).toHaveTitle(/AI Testing Shop/i);

    await shop.expectProductCount(3);
    await shop.expectSeedProductsVisible();

    const mouse = SEED_PRODUCTS[0]!;
    await shop.addToCart(mouse.name);

    const formatted = formatCzk(mouse.price);
    await shop.expectCartLineQuantity(mouse.name, 1);
    await shop.expectCartLineUnitPrice(mouse.name, formatted);
    await shop.expectCartSubtotalForProduct(mouse.name, formatted);
    await shop.expectEstimatedTotal(formatted);
  });
});
