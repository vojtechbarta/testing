import { test, expect } from "@playwright/test";
import { AdminPage } from "../pages/admin.page";
import { deleteAdminProduct, loginAsAdmin } from "../helpers/adminApi";

test.describe("Admin — products", () => {
  test("adds one product via UI; teardown removes it via API", async ({
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

      await admin.clickAddNewProduct();
      const row = admin.lastProductRow();
      await expect(row.locator("td").first()).toBeVisible();
      createdId = await admin.readRowProductId(row);

      await admin.setNameOnRow(row, uniqueName);
      await admin.saveRow(row);

      await admin.expectRowName(admin.lastProductRow(), uniqueName);
    } finally {
      if (createdId !== undefined) {
        const token = await loginAsAdmin(request);
        await deleteAdminProduct(request, token, createdId);
      }
    }
  });
});
