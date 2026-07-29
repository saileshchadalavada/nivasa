import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("Members Tab", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
    await navigateToTab(page, "Members");
  });

  test("members table renders", async ({ page }) => {
    const body = await page.textContent("body");
    expect(body.includes("Username") || body.includes("Flat")).toBeTruthy();
  });

  test("delete building section present", async ({ page }) => {
    await expect(page.locator('text=Delete this building')).toBeVisible({ timeout: 5000 });
  });

  test("no console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});
