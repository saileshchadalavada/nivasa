import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("Meter Scanning", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
    await navigateToTab(page, "Water");
  });

  test("bulk scan modal opens and closes", async ({ page }) => {
    await page.locator('button:has-text("Scan meter photos")').click();
    await expect(page.locator('text=Bulk-upload photos')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("✕")').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('th:has-text("FLAT")')).toBeVisible();
  });

  test("per-flat capture opens and closes cleanly", async ({ page }) => {
    await page.locator('button:has-text("📷")').first().click();
    await expect(page.locator('text=Take photo')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('th:has-text("FLAT")')).toBeVisible();
  });
});
