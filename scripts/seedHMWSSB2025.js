// One-time seed: HMWSSB Water Connection 2025
// Run: node scripts/seedHMWSSB2025.js
//
// Requires scripts/service-account.json and BUILDING_ID in .env.local

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

for (const f of [".env.local", ".env"]) {
  try { process.loadEnvFile(f); } catch {}
}

const bid = process.env.BUILDING_ID || process.argv[2];
if (!bid) {
  console.error("Missing BUILDING_ID. Add to .env.local or pass as first arg.");
  process.exit(1);
}

const saPath = new URL("./service-account.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
} catch {
  console.error("Service account key not found at scripts/service-account.json");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const eid = (p) => p + "_" + Math.random().toString(36).slice(2, 9);

// ── 15 Donations (₹20,000 per flat) ──────────────────────────────────────────
const donations = [
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 101", flat: "101", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 102", flat: "102", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 103", flat: "103", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 201", flat: "201", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 202", flat: "202", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 301", flat: "301", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 302", flat: "302", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 401", flat: "401", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 402", flat: "402", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 501", flat: "501", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 502", flat: "502", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 503", flat: "503", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 601", flat: "601", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 602", flat: "602", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
  { id: eid("d"), date: "2025-01-01", name: "Collection from Flat 603", flat: "603", amount: 20000, type: "contribution", remarks: "HMWSSB Water Connection", isExternal: false },
];

// ── 11 Expenses ───────────────────────────────────────────────────────────────
const expenses = [
  { id: eid("e"), date: "2025-01-15", description: "Application Fee",                                          amount:   2000, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-01-15", description: "Affidavit and Documentation for Bhupenda Garu",            amount:    500, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-01-15", description: "2 affidavits and Documentation for Vijaya Lakshmi Garu",   amount:    800, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-02-01", description: "Rapido Parcels and auto/cab expenses due to summer",       amount:   1500, status: "settled", paidBy: "", category: "transport", remarks: "" },
  { id: eid("e"), date: "2025-02-15", description: "Accessories bill 1 (Nipples Couplings Brass Valves Bend etc)", amount: 1945, status: "settled", paidBy: "", category: "misc",   remarks: "" },
  { id: eid("e"), date: "2025-02-15", description: "Accessories bill 2",                                       amount:   2100, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-03-01", description: "Final Invoice",                                            amount: 258250, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-03-15", description: "Watermeter",                                               amount:   6000, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-03-15", description: "Water Meter Service",                                      amount:    300, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-03-15", description: "Wages to Worker",                                          amount:    800, status: "settled", paidBy: "", category: "misc",      remarks: "" },
  { id: eid("e"), date: "2025-03-20", description: "Accessories bill 3",                                       amount:   1060, status: "settled", paidBy: "", category: "misc",      remarks: "" },
];

const totalDonations = donations.reduce((s, d) => s + d.amount, 0); // 300,000
const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0);  // 275,255
const closingBalance = totalDonations - totalExpenses;               // 24,745

const event = {
  name: "HMWSSB Water Connection",
  year: 2025,
  status: "closed",
  targetAmount: 300000,
  openingBalance: 0,
  closingBalance,
  donations,
  expenses,
  receivables: [],
  createdAt: new Date("2025-01-01").getTime(),
  updatedAt: new Date("2025-03-20").getTime(),
  closedAt:  new Date("2025-03-20").getTime(),
};

async function main() {
  const ref = db.collection("buildings").doc(bid).collection("events").doc();
  console.log(`Writing event to buildings/${bid}/events/${ref.id}…`);
  console.log(`  Donations : ${donations.length}  (total ₹${totalDonations.toLocaleString("en-IN")})`);
  console.log(`  Expenses  : ${expenses.length}  (total ₹${totalExpenses.toLocaleString("en-IN")})`);
  console.log(`  Closing balance: ₹${closingBalance.toLocaleString("en-IN")}`);

  await ref.set(event);
  console.log("Done. Event seeded successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
