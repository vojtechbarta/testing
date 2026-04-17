import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { ShopPage, SEED_PRODUCTS } from "../pages/shop.page";

test.describe("Shop — catalog and cart", () => {
  test("@smoke product grid cards do not overlap (DOM geometry check)", async ({
    page,
    browserName,
  }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    await shop.expectProductCount(15);

    const cards = page.locator(".product-grid .product-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const overlaps = await cards.evaluateAll((elements) => {
      const tol = 1; // tolerate tiny sub-pixel rounding differences
      const rects = elements.map((el, idx) => {
        const r = el.getBoundingClientRect();
        return { idx, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });

      const collisions = [];
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i];
          const b = rects[j];
          if (!a || !b) continue;
          const overlapX = a.right - tol > b.left && b.right - tol > a.left;
          const overlapY = a.bottom - tol > b.top && b.bottom - tol > a.top;
          if (overlapX && overlapY) {
            collisions.push({ first: a.idx, second: b.idx });
          }
        }
      }
      return collisions;
    });

    expect(
      overlaps,
      `Detected overlapping product cards in ${browserName}: ${JSON.stringify(overlaps)}`,
    ).toEqual([]);
  });

  test("@smoke home shows 15 seed products; add-to-cart shows cart line (amounts checked in API integration tests)", async ({
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
    const productsPath = await productsDownload.path();
    expect(productsPath).toBeTruthy();
    const productsContent = await readFile(productsPath!, "utf-8");
    expect(productsContent).toContain("Wireless Mouse M200");
    expect(productsContent.split("\n")[0]).toContain(
      "Name,Description,Price,In stock",
    );

    const mouse = SEED_PRODUCTS[0]!;
    await shop.addToCart(mouse.name);

    const cartDownload = await shop.exportCartCsv();
    expect(cartDownload.suggestedFilename()).toMatch(/cart-export-.*\.csv$/);
    const cartPath = await cartDownload.path();
    expect(cartPath).toBeTruthy();
    const cartContent = await readFile(cartPath!, "utf-8");
    expect(cartContent).toContain(mouse.name);
  });

  test("can export products and cart as PDF", async ({ page }) => {
    const shop = new ShopPage(page);

    await shop.goto();
    await shop.expectProductCount(15);

    const productsDownload = await shop.exportProductsPdf();
    expect(productsDownload.suggestedFilename()).toMatch(
      /products-export-.*\.pdf$/,
    );

    const mouse = SEED_PRODUCTS[0]!;
    await shop.addToCart(mouse.name);

    const cartDownload = await shop.exportCartPdf();
    expect(cartDownload.suggestedFilename()).toMatch(/cart-export-.*\.pdf$/);
  });
});
