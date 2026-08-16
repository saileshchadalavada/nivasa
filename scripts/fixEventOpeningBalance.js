/**
 * One-time data fix: set openingBalance to 0 for the 2026 Vinayaka Chaviti event.
 * Run: node scripts/fixEventOpeningBalance.js
 */

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const BID = "bKXm2zKZzByRLFhmwLFN";
const TARGET_NAME = "SR Gold Vinayaka Chaviti Utsavaalu 2026";

const saPath = new URL("./service-account.json", import.meta.url)
  .pathname.replace(/^\/([A-Z]:)/, "$1");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
} catch {
  console.error("✗ scripts/service-account.json not found.");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection(`buildings/${BID}/events`).get();
const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

console.log(`Found ${events.length} event(s) in building ${BID}:\n`);
events.forEach((e) => console.log(`  ${e.id}  "${e.name}"  openingBalance=${e.openingBalance ?? "(not set)"}`));
console.log();

const target = events.find((e) => e.name === TARGET_NAME);
if (!target) {
  console.error(`✗ Event "${TARGET_NAME}" not found. Check the name above and update TARGET_NAME.`);
  process.exit(1);
}

if (target.openingBalance === 0) {
  console.log(`✓ openingBalance is already 0 — nothing to do.`);
  process.exit(0);
}

console.log(`Updating "${target.name}" (${target.id}): openingBalance ${target.openingBalance} → 0`);
await db.doc(`buildings/${BID}/events/${target.id}`).update({ openingBalance: 0 });
console.log("✓ Done.");
