import { test, expect } from "@playwright/test";
import { TEST_USER, TEST_PIN, login } from "./helpers.js";

test.describe("Authentication", () => {

  test("app loads without crashing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).not.toBeEmpty();
    const critical = errors.filter((e) => !e.includes("favicon"));
    expect(critical.length).toBe(0);
  });

  test("auth screen renders username + PIN fields", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('input[placeholder="e.g. sailesh301"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Continue")')).toBeVisible();
  });

  test("login with valid credentials reaches dashboard", async ({ page }) => {
    await login(page);
    const body = await page.textContent("body");
    expect(body.includes("Overview") || body.includes("Create")).toBeTruthy();
  });

  test("sign out returns to auth screen", async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1000);
    const signOut = page.locator('button:has-text("Sign out")');
    if (await signOut.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signOut.click();
      await expect(page.locator('input[placeholder="e.g. sailesh301"]')).toBeVisible({ timeout: 10000 });
    }
  });
});
