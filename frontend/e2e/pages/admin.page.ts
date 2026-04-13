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

  async clickAddNewProduct(): Promise<void> {
    await this.page.getByRole("button", { name: "Add new product" }).click();
  }

  async setNameOnRow(row: Locator, name: string): Promise<void> {
    await row.getByRole("textbox").first().fill(name);
  }

  async saveRow(row: Locator): Promise<void> {
    await row.getByRole("button", { name: "Save" }).click();
  }

  async expectRowName(row: Locator, name: string): Promise<void> {
    await expect(row.getByRole("textbox").first()).toHaveValue(name);
  }
}
