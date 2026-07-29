# Nivasa — Apartment Water & Maintenance Ledger

A self-service React + Firebase app for a residential building. The first person
sets up the building and becomes admin; neighbours join via a WhatsApp invite
link with a username + 6-digit PIN and pick their flat. The admin grants roles;
role-holders edit their section, everyone else views.

## Roles

- **Admin** (whoever creates the building) — building settings, members, roles; can edit anything.
- **Treasurer** — edits the maintenance section.
- **Water in-charge** — edits the water section.
- **Everyone else** — view-only (overview, water, maintenance, their own flat statement).

Roles are additive — one person can be admin *and* water in-charge, etc.

## How the split works

```
flat_total = general_tankers_share    (by sub-meter %, Common counted in %)
           + manjeera_tankers ÷ N      (equal, residential flats only)
           + manjeera_connection ÷ N   (equal, residential flats only)
           + adjustment
           + maintenance ÷ N           (total common expense ÷ residential flats)
```

`N` = number of residential flats (from your setup — no longer hardcoded to 15).
Adhoc expenses a member fronts are tagged "Paid by" that flat and appear in an
"owed back to members" list.

## Setup

### 1. Firebase project
1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method →** enable **Email/Password**.
3. **Firestore Database →** create a database.
4. **Project settings → General → Your apps →** add a Web app, copy the config.

### 2. Configure & install
```bash
cp .env.example .env      # paste your Firebase web config into .env
npm install
```

### 3. Publish security rules
Firebase console → **Firestore → Rules →** paste `firestore.rules` and publish.

### 4. Run
```bash
npm run dev
```
The **first** person to open the app and sign up becomes the **admin** and walks
through building setup (name, location, floors, flats-per-floor). Your 15 real
flats + meter numbers are pre-filled and editable. After that, the admin shares
the invite (Overview → Share on WhatsApp); neighbours join, pick their flat, and
the admin assigns Treasurer / Water roles from the **Members** tab.

### 5. Deploy (optional)
```bash
npm run build
npx firebase-tools init hosting   # public dir: dist, single-page app: yes
npx firebase-tools deploy
```

## No seed script anymore
Setup is done in-app by the founder, so the old `seed.mjs` / service-account
step is gone. Nothing to run manually — just sign up first.

## Known limits / next steps
- **6-digit PINs** (Firebase password minimum); no in-app "change PIN" yet — admin resets via console.
- **Field-level permissions** are enforced in the UI; the rules allow any editor
  (admin/treasurer/water) to write the month document. True per-field lockdown is
  a later hardening step.
- **Building config is publicly readable** (so the join screen can show the
  building name). Only the name/location live there — no financial data.
- One month (`2026-07`) is created at setup; a **month switcher** and **historical
  import** are the natural next features.

## File map
```
src/
  firebase.js      Firebase init (reads .env)
  seedData.js      Prefill flats/meters, flat generation, role helpers
  data.js          Firestore access layer
  Auth.jsx         Login / join / founder sign-up
  Setup.jsx        Admin building-setup wizard
  Onboarding.jsx   New member picks their flat
  Members.jsx      Admin: roles + flat overrides
  App.jsx          Orchestrates auth → setup → onboarding → dashboard
  Dashboard.jsx    Overview · Water · Maintenance · My flat · Members
  styles.js        Design tokens + styles
  util.js          Rupee formatting
firestore.rules    Role-based access
```

## Historical water & the History tab (added)
`src/historicalWater.js` holds 32 months of real per-flat utilization (litres +
amount) extracted from `SR_gold_water_utilization.xlsx`, Apr 2023 – Jun 2026.
The **History** tab (visible to everyone) shows, for a flat: a year/month
dropdown, litres + bill for that month, your share-of-building donut, a litre
trend across all months, and this-month-vs-last / vs-average comparisons.
Periods are keyed by the consumption-period midpoint; date-entry typos and
duplicate blocks in the sheet were corrected during extraction.

Members can be marked **Flat owner** or **Tenant** at onboarding (view-only
either way); editing stays with the Water in-charge (water) and Treasurer roles.

## Auth is now one step (updated)
There's no separate "log in" vs "sign up" choice. Everyone enters username + PIN
and taps Continue: existing accounts are logged straight in; if there's no
building yet the first person's account is created (founder → setup); a new
joiner with a valid invite code gets an account and goes to flat onboarding.
A wrong PIN on an existing username shows "Wrong PIN", never a duplicate sign-up.

## Deploying on Vercel
`vercel.json` rewrites all paths to `index.html`, so refreshing an invite link
like `…/?join=ABC123` (or any future route) serves the app instead of 404ing.
Steps: push to a Git repo → import as a **new** Vercel project → add the six
`VITE_FB_*` env vars in Vercel settings → after the first deploy, add the
Vercel domain to Firebase **Authentication → Authorized domains** (or login
fails silently) → publish `firestore.rules` in the Firebase console.

## Multi-building (Path B) — structure
Data is now scoped per building:
```
users/{uid}                     account: { username, buildings: [bid...] }
buildings/{bid}                 config (name, location, floors, perFloor, adminUid, inviteCode)
buildings/{bid}/members/{uid}   per-building { flat, roles[], residentType, username }
buildings/{bid}/flats/{flat}
buildings/{bid}/months/{period}
```
One account can belong to many buildings, each with its own roles. The header
has a **building switcher** (and "+ New building"). Invite links are
`?b=<bid>&join=<code>`; opening one lets a signed-in account join that building
(pick a flat) without leaving their others. Founding a building or joining adds
its id to the account's `buildings` list. NOTE: this replaces the old
single-building layout — a building created under the previous version must be
re-created here. Republish `firestore.rules` (rewritten for subcollections).
