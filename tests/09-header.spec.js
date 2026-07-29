import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("Header & Navigation", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
  });

  test("all tabs render without console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => { if (!e.message.includes("favicon")) errors.push(e.message); });
    for (const tab of ["Overview", "Water", "Maintenance", "History", "Members"]) {
      await navigateToTab(page, tab);
      await page.waitForTimeout(500);
    }
    expect(errors.length).toBe(0);
  });

  test("theme switcher circles visible", async ({ page }) => {
    const circles = page.locator('header button[title]');
    const count = await circles.count();
    expect(count).toBeGreaterThanOrEqual(3); // 3 theme circles
  });

  test("header shows user info", async ({ page }) => {
    const header = page.locator("header");
    const text = await header.textContent();
    expect(text.includes("Sign out")).toBeTruthy();
  });
});
