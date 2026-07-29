import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("Maintenance Tab", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
    await navigateToTab(page, "Maintenance");
  });

  test("maintenance period section renders", async ({ page }) => {
    await expect(page.locator('text=Maintenance period')).toBeVisible({ timeout: 5000 });
  });

  test("expense table renders", async ({ page }) => {
    await expect(page.locator('th:has-text("ITEM")')).toBeVisible();
    await expect(page.locator('th:has-text("AMOUNT")')).toBeVisible();
  });

  test("summary cards render", async ({ page }) => {
    await expect(page.locator('text=Total spent')).toBeVisible();
    await expect(page.locator('text=Per flat')).toBeVisible();
  });

  test("publish bar visible", async ({ page }) => {
    await expect(page.locator('text=Publish maintenance')).toBeVisible();
  });

  test("backfill button present", async ({ page }) => {
    await expect(page.locator('button:has-text("Backfill")')).toBeVisible();
  });

  test("no console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});
