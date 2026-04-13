import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Must match `productsData` order in `backend/prisma/seed.ts`.
 * `id` is the DB `Product.id` after a fresh seed (products recreated 1..N).
 */
export const SEED_PRODUCTS = [
  { id: 1, name: "Wireless Mouse M200", price: 399 },
  { id: 2, name: "Mechanical Keyboard K87", price: 1790 },
  { id: 3, name: "27in QHD Monitor", price: 4990 },
  { id: 4, name: "USB-C Docking Station", price: 1690 },
  { id: 5, name: "Noise Cancelling Headphones", price: 2490 },
  { id: 6, name: "1080p Webcam", price: 890 },
  { id: 7, name: "Gaming Mouse Pad XL", price: 349 },
  { id: 8, name: "External SSD 1TB", price: 1890 },
  { id: 9, name: "USB-C Charger 65W", price: 699 },
  { id: 10, name: "Laptop Stand Aluminum", price: 499 },
  { id: 11, name: "Bluetooth Speaker Mini", price: 1190 },
  { id: 12, name: "Smart LED Desk Lamp", price: 699 },
  { id: 13, name: "Office Chair Ergo", price: 4990 },
  { id: 14, name: "Full HD Projector", price: 11990 },
  { id: 15, name: "Wi-Fi Router AX3000", price: 1490 },
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

export function formatCzk(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CZK",
  }).format(amount);
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

  async expectCartLineUnitPrice(
    productName: string,
    formattedPrice: string,
  ): Promise<void> {
    const meta = this.cartLineForProduct(productName).locator(
      ".cart-item__meta",
    );
    await expect(
      meta,
      `Cart line "${productName}": unit price should contain "${formattedPrice}" (en-US CZK format)`,
    ).toContainText(formattedPrice);
  }

  async expectCartSubtotalForProduct(
    productName: string,
    formattedPrice: string,
  ): Promise<void> {
    const sub = this.cartLineForProduct(productName).locator(
      ".cart-item__sub",
    );
    await expect(
      sub,
      `Cart line "${productName}": subtotal should contain "${formattedPrice}"`,
    ).toContainText(formattedPrice);
  }

  async expectEstimatedTotal(formattedPrice: string): Promise<void> {
    const total = this.page.getByTestId("cart-estimated-total");
    await expect(
      total,
      `Estimated cart total should contain "${formattedPrice}"`,
    ).toContainText(formattedPrice);
  }
}
