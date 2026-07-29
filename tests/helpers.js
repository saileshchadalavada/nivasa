/* Shared test helpers — login, navigation, selectors */

export const TEST_USER = "sailesh";
export const TEST_PIN = "232629";
export const TEST_BUILDING = "SR GOLD";

export async function login(page, username = TEST_USER, pin = TEST_PIN) {
  await page.goto("/");
  // wait for auth screen — the username input has placeholder "e.g. sailesh301"
  const usernameInput = page.locator('input[placeholder="e.g. sailesh301"]');
  await usernameInput.waitFor({ timeout: 10000 });
  await usernameInput.fill(username);
  // PIN input is type=password with placeholder "••••••"
  const pinInput = page.locator('input[type="password"]');
  await pinInput.fill(pin);
  // click Continue
  await page.locator('button:has-text("Continue")').click();
  // wait for post-auth state: either Landing ("Create") or Dashboard ("Overview")
  await page.waitForFunction(
    () => document.body.textContent.includes("Overview") || document.body.textContent.includes("Create your first"),
    { timeout: 15000 }
  );
}

export async function navigateToTab(page, tabName) {
  const tab = page.locator(`button:has-text("${tabName}")`).first();
  await tab.waitFor({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(500);
}

export async function waitForLoad(page) {
  // wait for "Loading ledger..." to disappear
  await page.waitForFunction(
    () => !document.body.textContent.includes("Loading ledger"),
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(500);
}
