import { test, expect } from "@playwright/test";
import { login, navigateToTab, waitForLoad } from "./helpers.js";

test.describe("History Tab", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForLoad(page);
    await navigateToTab(page, "History");
  });

  test("renders without crashing", async ({ page }) => {
    const body = await page.textContent("body");
    expect(body.includes("Flat") || body.includes("No history")).toBeTruthy();
    expect(body.includes("Cannot read")).toBeFalsy();
  });

  test("no console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});
