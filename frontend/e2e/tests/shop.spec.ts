import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { ShopPage, SEED_PRODUCTS } from "../pages/shop.page";

test.describe("Shop — catalog and cart", () => {
  test("@smoke discount promo banner is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shop-discount-promo")).toBeVisible();
    await expect(page.getByTestId("shop-discount-promo")).toContainText(
      "MoreIsLess",
    );
  });

  test("@smoke can apply MoreIsLess promo and clear discount", async ({
    page,
  }) => {
    const shop = new ShopPage(page);
    await shop.goto();

    const mouse = SEED_PRODUCTS[0]!;
    await shop.addToCart(mouse.name);
    await shop.increaseCartLineQuantity(mouse.name, 1);

    await shop.applyPromoCode("moreisless");

    await expect(page.getByTestId("cart-discount-amount")).toBeVisible();
    await expect(page.getByTestId("cart-discount-amount")).toContainText("€");
    await expect(page.getByTestId("cart-promo-clear")).toBeEnabled();

    await page.getByTestId("cart-promo-clear").click();
    await expect(page.getByTestId("cart-discount-amount")).toHaveCount(0);
  });

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

  test("product card stock count decreases after add to cart", async ({
    page,
  }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    const mouse = SEED_PRODUCTS[0]!;
    const card = shop.productCardByName(mouse.name);
    const stockLabel = card.locator(".product-card__stock");

    const beforeText = await stockLabel.innerText();
    const beforeMatch = beforeText.match(/(\d+)/);
    expect(
      beforeMatch,
      `Expected initial stock label to include a number, got "${beforeText}"`,
    ).not.toBeNull();
    const beforeStock = Number(beforeMatch![1]);

    await shop.addToCart(mouse.name);

    await expect
      .poll(async () => {
        const text = await stockLabel.innerText();
        const match = text.match(/(\d+)/);
        return match ? Number(match[1]) : null;
      })
      .toBe(beforeStock - 1);
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
      "Name,Description,Category,Price,In stock",
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

  test("category breadcrumb and multi-select filter are applied", async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    await shop.expectProductCount(15);

    await page.getByTestId("shop-category-filter-audio").check();
    await expect(page.locator(".product-card")).toHaveCount(2);

    const minInput = page.locator(".shop-controls__price-input").first();
    const maxInput = page.locator(".shop-controls__price-input").nth(1);
    const minBoundValue = await minInput.inputValue();
    await minInput.fill(minBoundValue);
    await maxInput.fill(minBoundValue);
    await expect
      .poll(async () => page.locator(".product-card").count())
      .toBeGreaterThan(0);
    await expect
      .poll(async () => page.locator(".product-card").count())
      .toBeLessThan(2);

    await page.getByTestId("shop-breadcrumb-all-categories").click();
    await expect(page.locator(".product-card")).toHaveCount(15);

    await shop.goto();
    await page.getByTestId("shop-category-breadcrumb-pick-video").click();
    await expect(page.locator(".product-card")).toHaveCount(3);
  });
});
