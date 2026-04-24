import { test, expect } from "@playwright/test";
import { AdminPage } from "../pages/admin.page";
import { deleteAdminProduct, loginAsAdmin } from "../helpers/adminApi";

test.describe("Admin — products", () => {
  test("@smoke adds one product via UI; teardown removes it via API", async ({
    page,
    request,
  }) => {
    const admin = new AdminPage(page);
    const uniqueName = `E2E Admin Product ${Date.now()}`;
    let createdId: number | undefined;

    try {
      await admin.goto();
      await admin.openAdminLogin();
      await admin.signIn();

      createdId = await admin.clickAddNewProduct();
      const row = admin.productRowById(createdId);
      await expect(row.locator("td").first()).toBeVisible();
      await expect(row.getByRole("textbox").first()).toHaveValue("New product", {
        timeout: 15_000,
      });

      await admin.setNameOnRow(row, uniqueName);
      await admin.saveRow(row);

      await admin.expectRowName(admin.productRowById(createdId), uniqueName);
    } finally {
      if (createdId !== undefined) {
        const token = await loginAsAdmin(request);
        await deleteAdminProduct(request, token, createdId);
      }
    }
  });

  test("can save and reload Czech translations in modal", async ({
    page,
    request,
  }) => {
    const admin = new AdminPage(page);
    let createdId: number | undefined;
    const translationName = `Preklad nazev ${Date.now()}`;
    const translationDescription = `Preklad popis ${Date.now()}`;

    try {
      await admin.goto();
      await admin.openAdminLogin();
      await admin.signIn();

      createdId = await admin.clickAddNewProduct();
      await admin.openCzechTranslationsByProductId(createdId);
      await admin.saveCzechTranslations(translationName, translationDescription);
      await admin.expectTranslationsModalClosed();

      await admin.openCzechTranslationsByProductId(createdId);
      await admin.expectCzechTranslationValues(translationName, translationDescription);
      await admin.closeTranslationsModal();
    } finally {
      if (createdId !== undefined) {
        const token = await loginAsAdmin(request);
        await deleteAdminProduct(request, token, createdId);
      }
    }
  });

  test("can select an existing seeded category on product row", async ({ page, request }) => {
    const admin = new AdminPage(page);
    let createdId: number | undefined;
    const categoryName = "audio";

    try {
      await admin.goto();
      await admin.openAdminLogin();
      await admin.signIn();

      createdId = await admin.clickAddNewProduct();
      await page
        .getByTestId(`admin-category-select-${createdId}`)
        .selectOption({ label: categoryName });
      await admin.saveRow(admin.productRowById(createdId));
      await expect(page.getByTestId(`admin-category-select-${createdId}`)).toContainText(
        categoryName,
      );
    } finally {
      if (createdId !== undefined) {
        const token = await loginAsAdmin(request);
        await deleteAdminProduct(request, token, createdId);
      }
    }
  });
});
