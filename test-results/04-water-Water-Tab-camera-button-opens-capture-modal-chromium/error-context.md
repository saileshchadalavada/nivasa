# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-water.spec.js >> Water Tab >> camera button opens capture modal
- Location: tests\04-water.spec.js:40:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=capture meter')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=capture meter')

```

```yaml
- banner:
  - combobox:
    - option "SR GOLD" [selected]
  - button "＋ Add"
  - text: Hyderabad, Telangana · 15 flats Water · Jun 2026 07 Jun 2026 → 08 Jul 2026 CS Ch Sailesh Admin · Flat 301
  - button "Indigo"
  - button "Teal"
  - button "Dark"
  - button "Sign out"
- navigation:
  - button "Overview"
  - button "Water"
  - button "Maintenance"
  - button "My flat"
  - button "History"
  - button "Members"
- main:
  - text: Scan meter photos Bulk-upload photos. We try to auto-read the serial + reading; tap any photo to enlarge and type the reading yourself. Nothing saves until you Apply.
  - button "✕"
  - text: 📁 Choose photos 📷 Take photo OCR is a helper — always verify readings against the photo.
  - button "Cancel"
  - button "Apply readings" [disabled]
  - heading "Water period — named by its start month" [level=2]
  - button "+ Backfill a month"
  - button "Delete this period"
  - button "Start next water period →"
  - text: Editing period
  - combobox:
    - option "Jun 2026 · 07 Jun 2026 → 08 Jul 2026 (current)" [selected]
    - option "May 2026 · 08 May 2026 → 06 Jun 2026"
    - option "Apr 2026 · 06 Apr 2026 → 08 May 2026"
    - option "Feb 2026 · 06 Feb 2026 → 06 Apr 2026"
    - option "Jan 2026 · 04 Jan 2026 → 06 Feb 2026"
  - text: From (start of period)
  - textbox "From (start of period)": 2026-06-07
  - text: To (meter reading date)
  - textbox "To (meter reading date)": 2026-07-08
  - heading "This period's water costs" [level=2]
  - text: General tankers · split by meter %
  - spinbutton "General tankers · split by meter %": "22"
  - text: General rate / tanker ₹
  - spinbutton "General rate / tanker ₹": "1400"
  - text: Manjeera tankers · split equally
  - spinbutton "Manjeera tankers · split equally"
  - text: Manjeera rate / tanker ₹
  - spinbutton "Manjeera rate / tanker ₹"
  - text: Manjeera connection (HMWSSB) · split equally ₹
  - spinbutton "Manjeera connection (HMWSSB) · split equally ₹"
  - text: General ₹30,800 + Manjeera tankers ₹0 + Connection ₹0.00 = ₹30,800
  - heading "Meter readings" [level=2]
  - checkbox "Adjustment column"
  - text: Adjustment column
  - button "📷 Scan meter photos"
  - table:
    - rowgroup:
      - row "Flat Meter Previous Current Used % Water bill":
        - columnheader "Flat"
        - columnheader "Meter"
        - columnheader "Previous"
        - columnheader "Current"
        - columnheader "Used"
        - columnheader "%"
        - columnheader "Water bill"
    - rowgroup:
      - row "101 4783/22 767030.5 📷 793219.3 26188.8 10.88 ₹3,701":
        - cell "101"
        - cell "4783/22":
          - textbox "serial": 4783/22
        - cell "767030.5":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "767030.5"
        - cell "📷 793219.3":
          - button "📷"
          - spinbutton: "793219.3"
        - cell "26188.8"
        - cell "10.88"
        - cell "₹3,701"
      - row "102 4440/22 341742.8 📷 347192.2 5449.4 2.26 ₹770":
        - cell "102"
        - cell "4440/22":
          - textbox "serial": 4440/22
        - cell "341742.8":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "341742.8"
        - cell "📷 347192.2":
          - button "📷"
          - spinbutton: "347192.2"
        - cell "5449.4"
        - cell "2.26"
        - cell "₹770"
      - row "103 5308/22 533582.7 📷 551140.9 17558.2 7.30 ₹2,481":
        - cell "103"
        - cell "5308/22":
          - textbox "serial": 5308/22
        - cell "533582.7":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "533582.7"
        - cell "📷 551140.9":
          - button "📷"
          - spinbutton: "551140.9"
        - cell "17558.2"
        - cell "7.30"
        - cell "₹2,481"
      - row "201 5042/22 516937.6 📷 532257.6 15320.0 6.37 ₹2,165":
        - cell "201"
        - cell "5042/22":
          - textbox "serial": 5042/22
        - cell "516937.6":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "516937.6"
        - cell "📷 532257.6":
          - button "📷"
          - spinbutton: "532257.6"
        - cell "15320.0"
        - cell "6.37"
        - cell "₹2,165"
      - row "202 4438/22 574809.6 📷 593274.8 18465.2 7.67 ₹2,610":
        - cell "202"
        - cell "4438/22":
          - textbox "serial": 4438/22
        - cell "574809.6":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "574809.6"
        - cell "📷 593274.8":
          - button "📷"
          - spinbutton: "593274.8"
        - cell "18465.2"
        - cell "7.67"
        - cell "₹2,610"
      - row "203 5309/22 517610.8 📷 529502.4 11891.6 4.94 ₹1,681":
        - cell "203"
        - cell "5309/22":
          - textbox "serial": 5309/22
        - cell "517610.8":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "517610.8"
        - cell "📷 529502.4":
          - button "📷"
          - spinbutton: "529502.4"
        - cell "11891.6"
        - cell "4.94"
        - cell "₹1,681"
      - row "301 4786/22 463803.8 📷 483503.3 19699.5 8.18 ₹2,784":
        - cell "301"
        - cell "4786/22":
          - textbox "serial": 4786/22
        - cell "463803.8":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "463803.8"
        - cell "📷 483503.3":
          - button "📷"
          - spinbutton: "483503.3"
        - cell "19699.5"
        - cell "8.18"
        - cell "₹2,784"
      - row "302 4431/22 554933.8 📷 571551.4 16617.6 6.90 ₹2,349":
        - cell "302"
        - cell "4431/22":
          - textbox "serial": 4431/22
        - cell "554933.8":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "554933.8"
        - cell "📷 571551.4":
          - button "📷"
          - spinbutton: "571551.4"
        - cell "16617.6"
        - cell "6.90"
        - cell "₹2,349"
      - row "303 5310/22 604620 📷 619719 15099.0 6.27 ₹2,134":
        - cell "303"
        - cell "5310/22":
          - textbox "serial": 5310/22
        - cell "604620":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "604620"
        - cell "📷 619719":
          - button "📷"
          - spinbutton: "619719"
        - cell "15099.0"
        - cell "6.27"
        - cell "₹2,134"
      - row "401 4781/22 606394.8 📷 620487.9 14093.1 5.86 ₹1,992":
        - cell "401"
        - cell "4781/22":
          - textbox "serial": 4781/22
        - cell "606394.8":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "606394.8"
        - cell "📷 620487.9":
          - button "📷"
          - spinbutton: "620487.9"
        - cell "14093.1"
        - cell "5.86"
        - cell "₹1,992"
      - row "402 5043/22 670807.4 📷 682056 11248.6 4.67 ₹1,590":
        - cell "402"
        - cell "5043/22":
          - textbox "serial": 5043/22
        - cell "670807.4":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "670807.4"
        - cell "📷 682056":
          - button "📷"
          - spinbutton: "682056"
        - cell "11248.6"
        - cell "4.67"
        - cell "₹1,590"
      - row "403 5047/22 285234.7 📷 287139 1904.3 0.79 ₹269":
        - cell "403"
        - cell "5047/22":
          - textbox "serial": 5047/22
        - cell "285234.7":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "285234.7"
        - cell "📷 287139":
          - button "📷"
          - spinbutton: "287139"
        - cell "1904.3"
        - cell "0.79"
        - cell "₹269"
      - row "501 4784/22 894563.9 📷 919181.8 24617.9 10.23 ₹3,479":
        - cell "501"
        - cell "4784/22":
          - textbox "serial": 4784/22
        - cell "894563.9":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "894563.9"
        - cell "📷 919181.8":
          - button "📷"
          - spinbutton: "919181.8"
        - cell "24617.9"
        - cell "10.23"
        - cell "₹3,479"
      - row "502 5045/22 571294.1 📷 585823 14528.9 6.04 ₹2,053":
        - cell "502"
        - cell "5045/22":
          - textbox "serial": 5045/22
        - cell "571294.1":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "571294.1"
        - cell "📷 585823":
          - button "📷"
          - spinbutton: "585823"
        - cell "14528.9"
        - cell "6.04"
        - cell "₹2,053"
      - row "503 4775/22 101953.2 📷 107203.2 5250.0 2.18 ₹742":
        - cell "503"
        - cell "4775/22":
          - textbox "serial": 4775/22
        - cell "101953.2":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "101953.2"
        - cell "📷 107203.2":
          - button "📷"
          - spinbutton: "107203.2"
        - cell "5250.0"
        - cell "2.18"
        - cell "₹742"
      - row "Common 5802/23 574258.6 📷 597013 22754.4 9.45 —":
        - cell "Common"
        - cell "5802/23":
          - textbox "serial": 5802/23
        - cell "574258.6":
          - spinbutton "Opening reading — edit if the meter was reset or replaced": "574258.6"
        - cell "📷 597013":
          - button "📷"
          - spinbutton: "597013"
        - cell "22754.4"
        - cell "9.45"
        - cell "—"
    - rowgroup:
      - row "Totals 240686.5 100.00 ₹30,800":
        - cell "Totals"
        - cell "240686.5"
        - cell "100.00"
        - cell "₹30,800"
  - paragraph: Common/Watchman counts toward the general-tanker % but carries no Manjeera or connection share. The Previous (opening) reading carries from last period but is editable — override it if a meter was reset or replaced.
  - text: Publish water to the group Last published 28 Jul 2026. Re-publish to share the latest.
  - button "📣 Publish & share"
  - text: Water period 07 Jun 2026 → 08 Jul 2026
- contentinfo: Everyone sees updates the moment an editor saves.
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { login, navigateToTab, waitForLoad } from "./helpers.js";
  3  | 
  4  | test.describe("Water Tab", () => {
  5  | 
  6  |   test.beforeEach(async ({ page }) => {
  7  |     await login(page);
  8  |     await waitForLoad(page);
  9  |     await navigateToTab(page, "Water");
  10 |   });
  11 | 
  12 |   test("period picker visible", async ({ page }) => {
  13 |     await expect(page.locator('text=Editing period')).toBeVisible({ timeout: 5000 });
  14 |   });
  15 | 
  16 |   test("date fields render", async ({ page }) => {
  17 |     await expect(page.locator('text=From (start of period)')).toBeVisible();
  18 |   });
  19 | 
  20 |   test("cost fields render", async ({ page }) => {
  21 |     await expect(page.locator('text=General tankers')).toBeVisible();
  22 |   });
  23 | 
  24 |   test("meter readings table renders", async ({ page }) => {
  25 |     await expect(page.locator('th:has-text("FLAT")')).toBeVisible();
  26 |     await expect(page.locator('th:has-text("METER")')).toBeVisible();
  27 |     await expect(page.locator('th:has-text("CURRENT")')).toBeVisible();
  28 |     await expect(page.locator('th:has-text("WATER BILL")')).toBeVisible();
  29 |   });
  30 | 
  31 |   test("scan button visible", async ({ page }) => {
  32 |     await expect(page.locator('button:has-text("Scan meter photos")')).toBeVisible();
  33 |   });
  34 | 
  35 |   test("camera button visible on rows", async ({ page }) => {
  36 |     const cam = page.locator('button:has-text("📷")').first();
  37 |     await expect(cam).toBeVisible({ timeout: 5000 });
  38 |   });
  39 | 
  40 |   test("camera button opens capture modal", async ({ page }) => {
  41 |     await page.locator('button:has-text("📷")').first().click();
> 42 |     await expect(page.locator('text=capture meter')).toBeVisible({ timeout: 5000 });
     |                                                      ^ Error: expect(locator).toBeVisible() failed
  43 |     await page.locator('button:has-text("Cancel")').click();
  44 |   });
  45 | 
  46 |   test("backfill button present", async ({ page }) => {
  47 |     await expect(page.locator('button:has-text("Backfill")')).toBeVisible();
  48 |   });
  49 | 
  50 |   test("publish bar visible", async ({ page }) => {
  51 |     await expect(page.locator('text=Publish water')).toBeVisible();
  52 |   });
  53 | 
  54 |   test("no console errors", async ({ page }) => {
  55 |     const errors = [];
  56 |     page.on("pageerror", (e) => errors.push(e.message));
  57 |     await page.waitForTimeout(2000);
  58 |     expect(errors.length).toBe(0);
  59 |   });
  60 | });
  61 | 
```