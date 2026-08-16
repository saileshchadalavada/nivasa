/**
 * Developer utility — clean up test member accounts from a building.
 *
 * Usage:
 *   node scripts/cleanTestUsers.js                          # dry run: list all members
 *   node scripts/cleanTestUsers.js --auto                   # delete all TEST_USERNAMES below
 *   node scripts/cleanTestUsers.js --delete uid1 uid2 ...  # delete by Firebase uid
 *   node scripts/cleanTestUsers.js --username name1 name2  # delete by username
 *
 * What it does for each deleted account:
 *   1. Deletes buildings/{bid}/members/{uid}
 *   2. Removes bid from users/{uid}.buildings   (arrayRemove)
 *   3. Deletes users/{uid} document entirely
 *
 * What it does NOT do (must be done manually in Firebase Console → Authentication):
 *   - Delete the Firebase Auth account itself
 *
 * Prerequisites: scripts/service-account.json must exist.
 * Download: Firebase Console → Project settings → Service accounts → Generate new private key
 */

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── Config ────────────────────────────────────────────────────────────────────

const BID = "bKXm2zKZzByRLFhmwLFN";

const TEST_USERNAMES = new Set([
  "testa", "testb", "testc", "testd", "teste", "testf",
  "testz", "testrunner",
  "srinandini", "srinandini07",
  "guestz1",
]);

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const saPath = new URL("./service-account.json", import.meta.url)
  .pathname.replace(/^\/([A-Z]:)/, "$1");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
} catch {
  console.error("✗ Service account key not found at scripts/service-account.json");
  console.error("  Download: Firebase Console → Project settings → Service accounts → Generate new private key");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function listMembers(bid) {
  const snap = await db.collection(`buildings/${bid}/members`).get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

async function deleteMember(bid, uid) {
  const batch = db.batch();
  // 1. Delete member doc
  batch.delete(db.doc(`buildings/${bid}/members/${uid}`));
  // 2. Remove bid from user's buildings array
  batch.update(db.doc(`users/${uid}`), { buildings: FieldValue.arrayRemove(bid) });
  await batch.commit();
  // 3. Delete the user doc (separate op — user doc may not have other buildings)
  await db.doc(`users/${uid}`).delete();
}

function pad(s, n) { return String(s).padEnd(n); }

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const autoFlag     = args.includes("--auto");
const deleteFlag   = args.includes("--delete");
const usernameFlag = args.includes("--username");

const flagIdx = deleteFlag   ? args.indexOf("--delete")
              : usernameFlag ? args.indexOf("--username")
              : -1;
const targets = flagIdx >= 0 ? args.slice(flagIdx + 1) : [];

const members = await listMembers(BID);

// ── Print roster ─────────────────────────────────────────────────────────────

console.log(`\nBuilding: ${BID}`);
console.log(`Members:  ${members.length}\n`);
console.log(pad("USERNAME", 20) + pad("UID", 32) + pad("TYPE", 10) + "FLAT");
console.log("─".repeat(74));
for (const m of members) {
  const mark = TEST_USERNAMES.has(m.username) ? " ← test" : "";
  console.log(
    pad(m.username || "(none)", 20) +
    pad(m.uid, 32) +
    pad(m.residentType || "?", 10) +
    (m.flat || "—") + mark
  );
}
console.log();

// ── Dry run ───────────────────────────────────────────────────────────────────

if (!autoFlag && !deleteFlag && !usernameFlag) {
  console.log("Dry run — no changes made.");
  console.log("  node scripts/cleanTestUsers.js --auto               # delete all test users above (marked ← test)");
  console.log("  node scripts/cleanTestUsers.js --username <name...> # delete by username");
  console.log("  node scripts/cleanTestUsers.js --delete <uid...>    # delete by uid");
  process.exit(0);
}

// ── Resolve targets ───────────────────────────────────────────────────────────

const toDelete = [];

if (autoFlag) {
  for (const m of members) {
    if (TEST_USERNAMES.has(m.username)) toDelete.push(m);
  }
  if (toDelete.length === 0) {
    console.log("No test users found in this building — nothing to do.");
    process.exit(0);
  }
} else if (usernameFlag) {
  if (targets.length === 0) { console.error("✗ No usernames specified after --username."); process.exit(1); }
  for (const name of targets) {
    const match = members.find((m) => m.username === name);
    if (!match) { console.warn(`  ⚠  Username "${name}" not found — skipping.`); continue; }
    toDelete.push(match);
  }
} else {
  // --delete: uids
  if (targets.length === 0) { console.error("✗ No UIDs specified after --delete."); process.exit(1); }
  for (const uid of targets) {
    const match = members.find((m) => m.uid === uid);
    if (!match) { console.warn(`  ⚠  UID "${uid}" not found — skipping.`); continue; }
    toDelete.push(match);
  }
}

if (toDelete.length === 0) { console.log("Nothing to delete."); process.exit(0); }

// ── Confirm ───────────────────────────────────────────────────────────────────

console.log("Will delete (member doc + user doc):");
for (const m of toDelete) {
  console.log(`  • ${m.username} (${m.uid})  type=${m.residentType}  flat=${m.flat || "—"}`);
}
console.log();
console.log("Press Ctrl-C within 5 s to abort…");
await new Promise((r) => setTimeout(r, 5000));

// ── Delete ────────────────────────────────────────────────────────────────────

let ok = 0, fail = 0;
for (const m of toDelete) {
  try {
    await deleteMember(BID, m.uid);
    console.log(`  ✓ Deleted ${m.username} (${m.uid})`);
    ok++;
  } catch (e) {
    console.error(`  ✗ Failed  ${m.username} (${m.uid}): ${e.message}`);
    fail++;
  }
}

console.log(`\nDone — ${ok} deleted, ${fail} failed.`);
if (ok > 0) {
  console.log("\nReminder: delete Firebase Auth accounts manually:");
  console.log("  Firebase Console → Authentication → Users → search → Delete");
  for (const m of toDelete.slice(0, ok)) {
    console.log(`    ${m.username}`);
  }
}
