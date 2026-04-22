import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Must match `productsData` order in `backend/prisma/seed.ts`.
 * `id` is the DB `Product.id` after a fresh seed (products recreated 1..N).
 */
export const SEED_PRODUCTS = [
  { id: 1, name: "Wireless Mouse M200", price: 17 },
  { id: 2, name: "Mechanical Keyboard K87", price: 75 },
  { id: 3, name: "27in QHD Monitor", price: 208 },
  { id: 4, name: "USB-C Docking Station", price: 70 },
  { id: 5, name: "Noise Cancelling Headphones", price: 104 },
  { id: 6, name: "1080p Webcam", price: 37 },
  { id: 7, name: "Gaming Mouse Pad XL", price: 15 },
  { id: 8, name: "External SSD 1TB", price: 79 },
  { id: 9, name: "USB-C Charger 65W", price: 29 },
  { id: 10, name: "Laptop Stand Aluminum", price: 21 },
  { id: 11, name: "Bluetooth Speaker Mini", price: 50 },
  { id: 12, name: "Smart LED Desk Lamp", price: 29 },
  { id: 13, name: "Office Chair Ergo", price: 208 },
  { id: 14, name: "Full HD Projector", price: 500 },
  { id: 15, name: "Wi-Fi Router AX3000", price: 62 },
] as const;

function seedProductByName(name: string): { id: number; name: string; price: number } {
  const p = SEED_PRODUCTS.find((x) => x.name === name);
  if (!p) {
    throw new Error(
      `Unknown seed product "${name}" — extend SEED_PRODUCTS to match prisma/seed.ts`,
    );
  }
  return p;
}

/**
 * Page object for the shop view (product grid + cart aside).
 */
export class ShopPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
  }

  productCardByName(productName: string): Locator {
    const { id } = seedProductByName(productName);
    return this.page.getByTestId(`shop-product-${id}`);
  }

  productTitles(): Locator {
    return this.page.locator(".product-card__title");
  }

  async expectProductCount(count: number): Promise<void> {
    const titles = this.productTitles();
    await expect(
      titles,
      `Product cards: expected ${count} titles (seed), got a different count — check API / CORS / DB seed`,
    ).toHaveCount(count);
  }

  /** Asserts every seed product title appears as h3.product-card__title (scrolls into view; long grid). */
  async expectSeedProductsVisible(): Promise<void> {
    for (const p of SEED_PRODUCTS) {
      const title = this.page.locator("h3.product-card__title", { hasText: p.name });
      await title.scrollIntoViewIfNeeded();
      await expect(
        title,
        `Missing product title "${p.name}" — expected all seed products on the grid`,
      ).toBeVisible();
    }
  }

  /**
   * Guards against Vite `/products` → API proxy accidentally serving product PNGs (broken images).
   * Requires `getProductImageSrcById` paths under `/catalog/` and files in `public/catalog/`.
   */
  async expectProductCardImagesDecoded(): Promise<void> {
    const imgs = this.page.locator(".product-card__image img");
    await expect(imgs.first(), "At least one product card should show an <img>").toBeVisible();
    const count = await imgs.count();
    expect(count, "Expected 15 product images for seed catalog").toBeGreaterThanOrEqual(15);
    for (let i = 0; i < Math.min(count, 15); i += 1) {
      const img = imgs.nth(i);
      await expect(img).toBeVisible();
      const w = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
      expect(
        w,
        `Product image #${i + 1} should load (naturalWidth > 0); check public/catalog/ and Vite proxy vs /products`,
      ).toBeGreaterThan(0);
    }
  }

  async addToCart(productName: string): Promise<void> {
    const { id } = seedProductByName(productName);
    await this.page.getByTestId(`shop-add-to-cart-${id}`).click();
  }

  cartLineForProduct(productName: string): Locator {
    const { id } = seedProductByName(productName);
    return this.page.getByTestId(`cart-line-${id}`);
  }

  /** Quantity is shown in `.cart-qty-label`; unit price appears in `.cart-item__meta`. */
  async expectCartLineQuantity(
    productName: string,
    quantity: number,
  ): Promise<void> {
    const qtyLoc = this.cartLineForProduct(productName).locator(
      ".cart-qty-label",
    );
    await expect(
      qtyLoc,
      `Cart line "${productName}": expected quantity ${quantity} (compare with .cart-qty-label text)`,
    ).toHaveText(String(quantity));
  }

  /**
   * UI-only: default EN storefront formats cart money with €.
   * Exact amounts and locale conversion math are asserted in backend integration tests.
   */
  async expectCartLineShowsEurMoneyUi(productName: string): Promise<void> {
    const line = this.cartLineForProduct(productName);
    await expect(line, `Cart line for "${productName}" should appear`).toBeVisible();
    const meta = line.locator(".cart-item__meta");
    const sub = line.locator(".cart-item__sub");
    await expect(meta).toBeVisible();
    await expect(sub).toBeVisible();
    await expect(meta).toContainText("€");
    await expect(sub).toContainText("€");
  }

  async expectEstimatedTotalShowsEurUi(): Promise<void> {
    const total = this.page.getByTestId("cart-estimated-total");
    await expect(total).toBeVisible();
    await expect(total).toContainText("€");
  }

  /**
   * Clicks the + control on a cart line (first `.cart-qty-btn` in the line) `times` times.
   */
  async increaseCartLineQuantity(productName: string, times: number): Promise<void> {
    const line = this.cartLineForProduct(productName);
    const plus = line.locator(".cart-qty-btn").first();
    for (let i = 0; i < times; i += 1) {
      await plus.click();
    }
  }

  async applyPromoCode(code: string): Promise<void> {
    await this.page.getByTestId("cart-promo-input").fill(code);
    await this.page.getByTestId("cart-promo-apply").click();
  }

  async exportProductsCsv(): Promise<import("@playwright/test").Download> {
    const exportPanel = this.page.locator(".shop-export-panel");
    const searchSection = exportPanel.locator(".shop-export-section").first();
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      searchSection.getByRole("button", { name: "CSV" }).click(),
    ]);
    return download;
  }

  async exportCartCsv(): Promise<import("@playwright/test").Download> {
    const exportPanel = this.page.locator(".shop-export-panel");
    const sections = exportPanel.locator(".shop-export-section");
    const cartSection = sections.nth(1);
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      cartSection.getByRole("button", { name: "CSV" }).click(),
    ]);
    return download;
  }

  async exportProductsPdf(): Promise<import("@playwright/test").Download> {
    const exportPanel = this.page.locator(".shop-export-panel");
    const searchSection = exportPanel.locator(".shop-export-section").first();
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      searchSection.getByRole("button", { name: "PDF" }).click(),
    ]);
    return download;
  }

  async exportCartPdf(): Promise<import("@playwright/test").Download> {
    const exportPanel = this.page.locator(".shop-export-panel");
    const sections = exportPanel.locator(".shop-export-section");
    const cartSection = sections.nth(1);
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      cartSection.getByRole("button", { name: "PDF" }).click(),
    ]);
    return download;
  }
}
