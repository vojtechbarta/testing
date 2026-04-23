import { type Locator, type Page, expect } from "@playwright/test";

export const ADMIN_CREDENTIALS = { username: "admin", password: "admin" } as const;

/**
 * Page object for admin login + product table (same URL as shop; `viewMode === "admin"`).
 */
export class AdminPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
  }

  async openAdminLogin(): Promise<void> {
    await this.page.getByRole("button", { name: "Login" }).click();
    await expect(this.page.getByRole("heading", { name: "Admin · Products" })).toBeVisible();
  }

  async signIn(): Promise<void> {
    await this.page.locator('input[name="username"]').fill(ADMIN_CREDENTIALS.username);
    await this.page.locator('input[name="password"]').fill(ADMIN_CREDENTIALS.password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
    await expect(this.page.getByRole("button", { name: "Add new product" })).toBeVisible();
  }

  /** Last body row — after “Add new product”, this is the newly created row (table sorted by id ascending). */
  lastProductRow(): Locator {
    return this.page.locator(".data-table tbody tr").last();
  }

  async readRowProductId(row: Locator): Promise<number> {
    const text = await row.locator("td").first().innerText();
    const id = Number(text.trim());
    if (!Number.isFinite(id)) {
      throw new Error(`Expected numeric product id in first cell, got "${text}"`);
    }
    return id;
  }

  /** Row whose first `td` is exactly the numeric product id (avoids matching id 1 inside 10). */
  productRowById(productId: number): Locator {
    return this.page
      .locator(".data-table tbody tr")
      .filter({
        has: this.page
          .locator("td")
          .first()
          .getByText(String(productId), { exact: true }),
      })
      .first();
  }

  /** Returns the new product `id` from the POST response body (avoids DOM races vs. last row). */
  async clickAddNewProduct(): Promise<number> {
    const [res] = await Promise.all([
      this.page.waitForResponse(
        (r) =>
          r.url().includes("/admin/products") &&
          r.request().method() === "POST" &&
          !/\/admin\/products\/\d+/.test(new URL(r.url()).pathname) &&
          r.ok(),
      ),
      this.page.getByRole("button", { name: "Add new product" }).click(),
    ]);
    const body = (await res.json()) as { id: number };
    return body.id;
  }

  async setNameOnRow(row: Locator, name: string): Promise<void> {
    const input = row.getByRole("textbox").first();
    await row.scrollIntoViewIfNeeded();
    await input.click();
    await input.fill(name);
    await expect(input).toHaveValue(name);
  }

  async saveRow(row: Locator): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (res) =>
          res.url().includes("/admin/products/") &&
          res.request().method() === "PUT" &&
          res.ok(),
      ),
      row.getByRole("button", { name: "Save" }).click(),
    ]);
  }

  async expectRowName(row: Locator, name: string): Promise<void> {
    await expect(row.getByRole("textbox").first()).toHaveValue(name);
  }

  async openCzechTranslationsByProductId(productId: number): Promise<void> {
    await this.page.getByTestId(`admin-open-translations-${productId}`).click();
    await expect(this.page.getByTestId("admin-translation-modal")).toBeVisible();
  }

  async saveCzechTranslations(name: string, description: string): Promise<void> {
    await this.page.getByTestId("admin-translation-cs-name").fill(name);
    await this.page.getByTestId("admin-translation-cs-description").fill(description);
    await Promise.all([
      this.page.waitForResponse(
        (res) =>
          /\/admin\/products\/\d+\/translations\/cs$/.test(new URL(res.url()).pathname) &&
          res.request().method() === "PUT" &&
          res.ok(),
      ),
      this.page.getByTestId("admin-translation-save").click(),
    ]);
  }

  async expectTranslationsModalClosed(): Promise<void> {
    await expect(this.page.getByTestId("admin-translation-modal")).toHaveCount(0);
  }

  async expectCzechTranslationValues(name: string, description: string): Promise<void> {
    await expect(this.page.getByTestId("admin-translation-cs-name")).toHaveValue(name);
    await expect(this.page.getByTestId("admin-translation-cs-description")).toHaveValue(
      description,
    );
  }

  async closeTranslationsModal(): Promise<void> {
    await this.page.getByRole("button", { name: "Cancel" }).click();
    await expect(this.page.getByTestId("admin-translation-modal")).toHaveCount(0);
  }
}
