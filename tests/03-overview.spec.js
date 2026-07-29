import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("Overview Tab", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
  });

  test("shows summary cards", async ({ page }) => {
    await navigateToTab(page, "Overview");
    await expect(page.locator('text=Water this period')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Maintenance this period')).toBeVisible();
    await expect(page.locator('text=Total billable')).toBeVisible();
    await expect(page.locator('text=Collected')).toBeVisible();
  });

  test("shows collection status section", async ({ page }) => {
    await navigateToTab(page, "Overview");
    await expect(page.locator('text=Collection status')).toBeVisible({ timeout: 5000 });
  });

  test("shows per-flat statement table", async ({ page }) => {
    await navigateToTab(page, "Overview");
    await expect(page.locator('text=Per-flat statement')).toBeVisible({ timeout: 5000 });
  });

  test("shows billing strip with both cycles", async ({ page }) => {
    await navigateToTab(page, "Overview");
    const body = await page.textContent("body");
    expect(body.includes("Water") && body.includes("Maintenance")).toBeTruthy();
  });
});
