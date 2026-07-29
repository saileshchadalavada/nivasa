import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("Publish & Share", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
  });

  test("water publish opens modal with tabs", async ({ page }) => {
    await navigateToTab(page, "Water");
    await page.locator('button:has-text("Publish")').first().click();
    await expect(page.locator('text=Image poster')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Text message')).toBeVisible();
  });

  test("poster preview renders as PNG", async ({ page }) => {
    await navigateToTab(page, "Water");
    await page.locator('button:has-text("Publish")').first().click();
    const img = page.locator('img[alt="poster"]');
    await expect(img).toBeVisible({ timeout: 5000 });
    const src = await img.getAttribute("src");
    expect(src).toContain("data:image/png");
  });

  test("text tab has WhatsApp buttons", async ({ page }) => {
    await navigateToTab(page, "Water");
    await page.locator('button:has-text("Publish")').first().click();
    await page.locator('button:has-text("Text message")').click();
    await expect(page.locator('button:has-text("WhatsApp App")')).toBeVisible();
    await expect(page.locator('button:has-text("WhatsApp Web")')).toBeVisible();
  });

  test("modal closes cleanly", async ({ page }) => {
    await navigateToTab(page, "Water");
    await page.locator('button:has-text("Publish")').first().click();
    await page.locator('button:has-text("✕")').first().click();
    await expect(page.locator('img[alt="poster"]')).not.toBeVisible({ timeout: 3000 });
  });
});
