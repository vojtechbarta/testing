import { type Locator, type Page, expect } from "@playwright/test";

export const TESTER_CREDENTIALS = { username: "tester", password: "tester" } as const;

/** Page object for tester login + bugs/fault management UI. */
export class TesterPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
  }

  async openLogin(): Promise<void> {
    await this.page.getByRole("button", { name: "Login" }).click();
    await expect(this.page.getByRole("heading", { name: "Admin · Products" })).toBeVisible();
  }

  async signIn(): Promise<void> {
    await this.page.locator('input[name="username"]').fill(TESTER_CREDENTIALS.username);
    await this.page.locator('input[name="password"]').fill(TESTER_CREDENTIALS.password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
    await expect(this.page.getByRole("button", { name: "Bugs" })).toBeVisible();
  }

  async openBugs(): Promise<void> {
    await this.page.getByRole("button", { name: "Bugs" }).click();
    await expect(this.page.getByRole("heading", { name: "Fault injection" })).toBeVisible();
  }

  async expectTesterSessionChip(): Promise<void> {
    await expect(this.page.getByText("tester · Logout")).toBeVisible();
  }

  async expectAdminButtonHiddenForTester(): Promise<void> {
    await expect(this.page.getByRole("button", { name: "Admin" })).toHaveCount(0);
  }

  faultsTableRows(): Locator {
    return this.page.locator(".data-table tbody tr");
  }

  firstFaultRow(): Locator {
    return this.faultsTableRows().first();
  }

  async filterFaultsByLevel(level: "ALL" | "UI" | "API" | "Unit"): Promise<void> {
    await this.page.locator(".faults-level-filter select").selectOption(level);
  }

  async saveAllFaults(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (res) =>
          res.url().includes("/admin/faults/") &&
          res.request().method() === "PATCH" &&
          res.ok(),
      ),
      this.page.getByRole("button", { name: "Save all faults" }).click(),
    ]);
  }
}
