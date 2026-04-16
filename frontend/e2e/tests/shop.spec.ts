import { test, expect } from "@playwright/test";
import { ShopPage, SEED_PRODUCTS } from "../pages/shop.page";

test.describe("Shop — catalog and cart", () => {
  test("home shows 15 seed products; add-to-cart shows cart line (amounts checked in API integration tests)", async ({
    page,
  }) => {
    const shop = new ShopPage(page);

    await shop.goto();
    await expect(
      page,
      "Browser tab title should be AI Testing Shop (see index.html <title>)",
    ).toHaveTitle(/AI Testing Shop/i);

    await shop.expectProductCount(15);
    await shop.expectSeedProductsVisible();
    await shop.expectProductCardImagesDecoded();

    const mouse = SEED_PRODUCTS[0]!;
    await shop.addToCart(mouse.name);

    await shop.expectCartLineQuantity(mouse.name, 1);
    await shop.expectCartLineShowsEurMoneyUi(mouse.name);
    await shop.expectEstimatedTotalShowsEurUi();
  });

  test("can export products and cart as CSV", async ({ page }) => {
    const shop = new ShopPage(page);

    await shop.goto();
    await shop.expectProductCount(15);

    const productsDownload = await shop.exportProductsCsv();
    expect(productsDownload.suggestedFilename()).toMatch(
      /products-export-.*\.csv$/,
    );
    const productsContent = await productsDownload.text();
    expect(productsContent).toContain("Wireless Mouse M200");
    expect(productsContent.split("\n")[0]).toContain(
      "Name,Description,Price,In stock",
    );

    const mouse = SEED_PRODUCTS[0]!;
    await shop.addToCart(mouse.name);

    const cartDownload = await shop.exportCartCsv();
    expect(cartDownload.suggestedFilename()).toMatch(/cart-export-.*\.csv$/);
    const cartContent = await cartDownload.text();
    expect(cartContent).toContain(mouse.name);
  });
});
