# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-maintenance.spec.js >> Maintenance Tab >> maintenance period section renders
- Location: tests\05-maintenance.spec.js:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Maintenance period')
Expected: visible
Error: strict mode violation: locator('text=Maintenance period') resolved to 3 elements:
    1) <h2>…</h2> aka getByRole('heading', { name: 'Maintenance period — calendar' })
    2) <button title="" class="add">Start next maintenance period →</button> aka getByRole('button', { name: 'Start next maintenance period' })
    3) <span>Maintenance period</span> aka getByText('Maintenance period', { exact: true })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Maintenance period')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e27]:
      - generic [ref=e28]:
        - combobox [ref=e29] [cursor=pointer]:
          - option "SR GOLD" [selected]
        - button "＋ Add" [ref=e30] [cursor=pointer]
      - generic [ref=e31]: Hyderabad, Telangana · 15 flats
    - generic [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e34]: Maintenance · Jun 2026
        - generic [ref=e35]: 01 Jun 2026 → 30 Jun 2026
      - generic [ref=e36]:
        - generic [ref=e37]: CS
        - generic [ref=e38]:
          - generic [ref=e39]: Ch Sailesh
          - generic [ref=e40]: Admin · Flat 301
          - generic [ref=e41]:
            - button "Indigo" [ref=e42] [cursor=pointer]
            - button "Teal" [ref=e43] [cursor=pointer]
            - button "Dark" [ref=e44] [cursor=pointer]
          - button "Sign out" [ref=e45] [cursor=pointer]
  - navigation [ref=e46]:
    - button "Overview" [ref=e47] [cursor=pointer]
    - button "Water" [ref=e48] [cursor=pointer]
    - button "Maintenance" [active] [ref=e49] [cursor=pointer]
    - button "My flat" [ref=e50] [cursor=pointer]
    - button "History" [ref=e51] [cursor=pointer]
    - button "Members" [ref=e52] [cursor=pointer]
  - main [ref=e53]:
    - generic [ref=e54]:
      - heading "Maintenance period — calendar month" [level=2] [ref=e55]:
        - text: Maintenance period
        - generic [ref=e56]: — calendar month
      - generic [ref=e57]:
        - button "+ Backfill a month" [ref=e58] [cursor=pointer]
        - button "Start next maintenance period →" [ref=e59] [cursor=pointer]
    - generic [ref=e60]:
      - generic [ref=e61]: Editing period
      - combobox [ref=e62]:
        - option "Jun 2026 · 01 Jun 2026 → 30 Jun 2026 (current)" [selected]
      - generic [ref=e63]: Add or backfill periods and they'll appear here to select & edit.
    - generic [ref=e64]:
      - generic [ref=e65]:
        - generic [ref=e66]: From (start of period)
        - textbox "From (start of period)" [ref=e67]: 2026-06-01
      - generic [ref=e68]:
        - generic [ref=e69]: To (end of month)
        - textbox "To (end of month)" [ref=e70]: 2026-06-30
    - generic [ref=e71]:
      - generic [ref=e72]:
        - generic [ref=e73]: Total spent
        - generic [ref=e74]: ₹31,463
        - generic [ref=e75]: 10 line items
      - generic [ref=e76]:
        - generic [ref=e77]: Per flat
        - generic [ref=e78]: ₹2,098
        - generic [ref=e79]: total ÷ 15 flats
      - generic [ref=e80]:
        - generic [ref=e81]: Owed to members
        - generic [ref=e82]: ₹930
        - generic [ref=e83]: adhoc expenses fronted
    - heading "Expense items — set \"Paid by\" to a flat when a member fronts the cost" [level=2] [ref=e84]
    - table [ref=e86]:
      - rowgroup [ref=e87]:
        - row [ref=e88]:
          - columnheader "Item" [ref=e89]
          - columnheader "Amount" [ref=e90]
          - columnheader "Paid by" [ref=e91]
          - columnheader "Repeats monthly" [ref=e92]
          - columnheader [ref=e93]
      - rowgroup [ref=e94]:
        - row [ref=e95]:
          - cell [ref=e96]:
            - textbox "e.g. Watchman salary" [ref=e97]: Watchman salary
          - cell [ref=e98]:
            - spinbutton [ref=e99]: "7500"
          - cell "Association fund" [ref=e100]:
            - combobox [ref=e101]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e102]:
            - checkbox "Carry this item into next month" [ref=e103] [cursor=pointer]
          - cell [ref=e104]:
            - button "✕" [ref=e105] [cursor=pointer]
        - row [ref=e106]:
          - cell [ref=e107]:
            - textbox "e.g. Watchman salary" [ref=e108]: Garbage collection
          - cell [ref=e109]:
            - spinbutton [ref=e110]: "1800"
          - cell "Association fund" [ref=e111]:
            - combobox [ref=e112]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e113]:
            - checkbox "Carry this item into next month" [ref=e114] [cursor=pointer]
          - cell [ref=e115]:
            - button "✕" [ref=e116] [cursor=pointer]
        - row [ref=e117]:
          - cell [ref=e118]:
            - textbox "e.g. Watchman salary" [ref=e119]: Common power bill
          - cell [ref=e120]:
            - spinbutton [ref=e121]: "6633"
          - cell "Association fund" [ref=e122]:
            - combobox [ref=e123]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e124]:
            - checkbox "Carry this item into next month" [ref=e125] [cursor=pointer]
          - cell [ref=e126]:
            - button "✕" [ref=e127] [cursor=pointer]
        - row [ref=e128]:
          - cell [ref=e129]:
            - textbox "e.g. Watchman salary" [ref=e130]: Sump + tank cleaning
          - cell [ref=e131]:
            - spinbutton [ref=e132]: "1100"
          - cell "Association fund" [ref=e133]:
            - combobox [ref=e134]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e135]:
            - checkbox "Carry this item into next month" [ref=e136] [cursor=pointer]
          - cell [ref=e137]:
            - button "✕" [ref=e138] [cursor=pointer]
        - row [ref=e139]:
          - cell [ref=e140]:
            - textbox "e.g. Watchman salary" [ref=e141]: Lizol / Muggu
          - cell [ref=e142]:
            - spinbutton [ref=e143]: "300"
          - cell "Association fund" [ref=e144]:
            - combobox [ref=e145]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e146]:
            - checkbox "Carry this item into next month" [ref=e147] [cursor=pointer]
          - cell [ref=e148]:
            - button "✕" [ref=e149] [cursor=pointer]
        - row [ref=e150]:
          - cell [ref=e151]:
            - textbox "e.g. Watchman salary" [ref=e152]: Lift AMC
          - cell [ref=e153]:
            - spinbutton [ref=e154]: "10000"
          - cell "Association fund" [ref=e155]:
            - combobox [ref=e156]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e157]:
            - checkbox "Carry this item into next month" [ref=e158] [cursor=pointer]
          - cell [ref=e159]:
            - button "✕" [ref=e160] [cursor=pointer]
        - row [ref=e161]:
          - cell [ref=e162]:
            - textbox "e.g. Watchman salary" [ref=e163]: Drainage cleaning (cellar)
          - cell [ref=e164]:
            - spinbutton [ref=e165]: "3000"
          - cell "Association fund" [ref=e166]:
            - combobox [ref=e167]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e168]:
            - checkbox "Carry this item into next month" [ref=e169] [cursor=pointer]
          - cell [ref=e170]:
            - button "✕" [ref=e171] [cursor=pointer]
        - row [ref=e172]:
          - cell [ref=e173]:
            - textbox "e.g. Watchman salary" [ref=e174]: Bulbs (101 / common)
          - cell [ref=e175]:
            - spinbutton [ref=e176]: "200"
          - cell "Association fund" [ref=e177]:
            - combobox [ref=e178]:
              - option "Association fund" [selected]
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e179]:
            - checkbox "Carry this item into next month" [ref=e180] [cursor=pointer]
          - cell [ref=e181]:
            - button "✕" [ref=e182] [cursor=pointer]
        - row [ref=e183]:
          - cell [ref=e184]:
            - textbox "e.g. Watchman salary" [ref=e185]: Water meter repair (503)
          - cell [ref=e186]:
            - spinbutton [ref=e187]: "500"
          - cell "Flat 402 — ASK Chaitanya Varma" [ref=e188]:
            - combobox [ref=e189]:
              - option "Association fund"
              - option "Flat 101 — M Srinivas"
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma" [selected]
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e190]:
            - checkbox "Carry this item into next month" [ref=e191] [cursor=pointer]
          - cell [ref=e192]:
            - button "✕" [ref=e193] [cursor=pointer]
        - row [ref=e194]:
          - cell [ref=e195]:
            - textbox "e.g. Watchman salary" [ref=e196]: Plumbing issue (series 1)
          - cell [ref=e197]:
            - spinbutton [ref=e198]: "430"
          - cell "Flat 101 — M Srinivas" [ref=e199]:
            - combobox [ref=e200]:
              - option "Association fund"
              - option "Flat 101 — M Srinivas" [selected]
              - option "Flat 102 — Y Sai Kiran"
              - option "Flat 103 — B Nagarjuna"
              - option "Flat 201 — P Jagadeesh"
              - option "Flat 202 — T Vamsi Krishna"
              - option "Flat 203 — P Bhavani"
              - option "Flat 301 — Ch Sailesh"
              - option "Flat 302 — T Dileep Kumar"
              - option "Flat 303 — V Ravikanth"
              - option "Flat 401 — P Nirmala"
              - option "Flat 402 — ASK Chaitanya Varma"
              - option "Flat 403 — P Vani"
              - option "Flat 501 — Bhupendra Patre"
              - option "Flat 502 — M Pradeep"
              - option "Flat 503 — V Ramesh"
          - cell [ref=e201]:
            - checkbox "Carry this item into next month" [ref=e202] [cursor=pointer]
          - cell [ref=e203]:
            - button "✕" [ref=e204] [cursor=pointer]
      - rowgroup [ref=e205]:
        - row [ref=e206]:
          - cell "Total" [ref=e207]
          - cell "₹31,463" [ref=e208]
          - cell [ref=e209]
    - button "+ Add expense" [ref=e210] [cursor=pointer]
    - generic [ref=e211]:
      - generic [ref=e212]:
        - generic [ref=e213]: Publish maintenance to the group
        - generic [ref=e214]: Last published 28 Jul 2026. Re-publish to share the latest.
      - button "📣 Publish & share" [ref=e215] [cursor=pointer]
    - generic [ref=e216]:
      - generic [ref=e217]: Maintenance period
      - generic [ref=e218]: 01 Jun 2026 → 30 Jun 2026
  - contentinfo [ref=e219]: Everyone sees updates the moment an editor saves.
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { login, navigateToTab, waitForLoad } from "./helpers.js";
  3  | 
  4  | test.describe("Maintenance Tab", () => {
  5  | 
  6  |   test.beforeEach(async ({ page }) => {
  7  |     await login(page);
  8  |     await waitForLoad(page);
  9  |     await navigateToTab(page, "Maintenance");
  10 |   });
  11 | 
  12 |   test("maintenance period section renders", async ({ page }) => {
> 13 |     await expect(page.locator('text=Maintenance period')).toBeVisible({ timeout: 5000 });
     |                                                           ^ Error: expect(locator).toBeVisible() failed
  14 |   });
  15 | 
  16 |   test("expense table renders", async ({ page }) => {
  17 |     await expect(page.locator('th:has-text("ITEM")')).toBeVisible();
  18 |     await expect(page.locator('th:has-text("AMOUNT")')).toBeVisible();
  19 |   });
  20 | 
  21 |   test("summary cards render", async ({ page }) => {
  22 |     await expect(page.locator('text=Total spent')).toBeVisible();
  23 |     await expect(page.locator('text=Per flat')).toBeVisible();
  24 |   });
  25 | 
  26 |   test("publish bar visible", async ({ page }) => {
  27 |     await expect(page.locator('text=Publish maintenance')).toBeVisible();
  28 |   });
  29 | 
  30 |   test("backfill button present", async ({ page }) => {
  31 |     await expect(page.locator('button:has-text("Backfill")')).toBeVisible();
  32 |   });
  33 | 
  34 |   test("no console errors", async ({ page }) => {
  35 |     const errors = [];
  36 |     page.on("pageerror", (e) => errors.push(e.message));
  37 |     await page.waitForTimeout(2000);
  38 |     expect(errors.length).toBe(0);
  39 |   });
  40 | });
  41 | 
```