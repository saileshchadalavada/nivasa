import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("Water Tab", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
    await navigateToTab(page, "Water");
  });

  test("period picker visible", async ({ page }) => {
    await expect(page.locator('text=Editing period')).toBeVisible({ timeout: 5000 });
  });

  test("date fields render", async ({ page }) => {
    await expect(page.locator('text=From (start of period)')).toBeVisible();
  });

  test("cost fields render", async ({ page }) => {
    await expect(page.locator('text=General tankers')).toBeVisible();
  });

  test("meter readings table renders", async ({ page }) => {
    await expect(page.locator('th:has-text("FLAT")')).toBeVisible();
    await expect(page.locator('th:has-text("METER")')).toBeVisible();
    await expect(page.locator('th:has-text("CURRENT")')).toBeVisible();
    await expect(page.locator('th:has-text("WATER BILL")')).toBeVisible();
  });

  test("scan button visible", async ({ page }) => {
    await expect(page.locator('button:has-text("Scan meter photos")')).toBeVisible();
  });

  test("camera button visible on rows", async ({ page }) => {
    const cam = page.locator('button:has-text("📷")').first();
    await expect(cam).toBeVisible({ timeout: 5000 });
  });

  test("camera button opens capture modal", async ({ page }) => {
    await page.locator('button:has-text("📷")').first().click();
    await expect(page.locator('text=capture meter')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Cancel")').click();
  });

  test("backfill button present", async ({ page }) => {
    await expect(page.locator('button:has-text("Backfill")')).toBeVisible();
  });

  test("publish bar visible", async ({ page }) => {
    await expect(page.locator('text=Publish water')).toBeVisible();
  });

  test("no console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});
