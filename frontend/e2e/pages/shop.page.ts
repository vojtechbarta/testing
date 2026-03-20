import { type Locator, type Page, expect } from "@playwright/test";

/** Must match `productsData` in `backend/prisma/seed.ts` */
export const SEED_PRODUCTS = [
  { name: "Test Mouse", price: 499 },
  { name: "Test Keyboard", price: 1299 },
  { name: "QA Monitor", price: 3999 },
] as const;

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
    return this.page.locator(".product-card").filter({
      has: this.page.getByRole("heading", { level: 3, name: productName }),
    });
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

  /** Asserts the three seed product titles appear as h3 headings. */
  async expectSeedProductsVisible(): Promise<void> {
    for (const p of SEED_PRODUCTS) {
      await expect(
        this.page.getByRole("heading", { level: 3, name: p.name }),
        `Missing product heading "${p.name}" — expected all seed products on the grid`,
      ).toBeVisible();
    }
  }

  async addToCart(productName: string): Promise<void> {
    const card = this.productCardByName(productName);
    await card.getByRole("button", { name: "Add to Cart" }).click();
  }

  cartLineForProduct(productName: string): Locator {
    return this.page.locator(".cart-item").filter({
      has: this.page.locator(".cart-item__name", { hasText: productName }),
    });
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
    const total = this.page.locator(".cart-total-row strong");
    await expect(
      total,
      `Estimated cart total should contain "${formattedPrice}"`,
    ).toContainText(formattedPrice);
  }
}
