import { test, expect } from "@playwright/test";
import { login, waitForLoad } from "./helpers.js";

test.describe("Building Management", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
  });

  test("header shows building dropdown", async ({ page }) => {
    const select = page.locator("header select").first();
    await expect(select).toBeVisible({ timeout: 5000 });
  });

  test("header shows Add button", async ({ page }) => {
    await expect(page.locator('button:has-text("Add")')).toBeVisible({ timeout: 5000 });
  });

  test("Add button opens setup wizard", async ({ page }) => {
    await page.locator('button:has-text("Add")').click();
    await expect(page.locator('text=Name your building')).toBeVisible({ timeout: 5000 });
  });
});
