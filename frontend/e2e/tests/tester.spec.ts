import { test, expect } from "@playwright/test";
import { TesterPage } from "../pages/tester.page";

test.describe("Tester — bugs/faults perspective", () => {
  test("tester can sign in and gets tester session chrome", async ({ page }) => {
    const tester = new TesterPage(page);
    await tester.goto();
    await tester.openLogin();
    await tester.signIn();
    await tester.expectTesterSessionChip();
  });

  test("tester role sees Bugs navigation and does not see Admin navigation", async ({
    page,
  }) => {
    const tester = new TesterPage(page);
    await tester.goto();
    await tester.openLogin();
    await tester.signIn();
    await tester.expectAdminButtonHiddenForTester();
    await expect(page.getByRole("button", { name: "Bugs" })).toBeVisible();
  });

  test("tester can open fault-injection view and sees editable faults grid", async ({
    page,
  }) => {
    const tester = new TesterPage(page);
    await tester.goto();
    await tester.openLogin();
    await tester.signIn();
    await tester.openBugs();
    await expect(tester.faultsTableRows().first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save all faults" })).toBeEnabled();
  });

  test("tester can filter faults by UI level", async ({ page }) => {
    const tester = new TesterPage(page);
    await tester.goto();
    await tester.openLogin();
    await tester.signIn();
    await tester.openBugs();
    await tester.filterFaultsByLevel("UI");
    await expect(tester.faultsTableRows().first()).toBeVisible();
    await expect(tester.firstFaultRow().locator("select").first()).toHaveValue("UI");
  });

  test("tester can save fault changes (toggle and restore)", async ({ page }) => {
    const tester = new TesterPage(page);
    await tester.goto();
    await tester.openLogin();
    await tester.signIn();
    await tester.openBugs();

    const enabledCheckbox = tester.firstFaultRow().locator('input[type="checkbox"]').first();
    const initial = await enabledCheckbox.isChecked();
    await enabledCheckbox.click();
    await enabledCheckbox.click();

    await tester.saveAllFaults();
    if (initial) {
      await expect(enabledCheckbox).toBeChecked();
    } else {
      await expect(enabledCheckbox).not.toBeChecked();
    }
    await expect(page.locator(".store-alert--error")).toHaveCount(0);
  });
});
