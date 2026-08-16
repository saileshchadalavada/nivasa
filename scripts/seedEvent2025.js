// One-time seed: SR Gold Vinayaka Chaviti Utsavaalu 2025
// Run: node scripts/seedEvent2025.js
//
// Prerequisites:
//   1. Download service account key from Firebase Console → Project settings →
//      Service accounts → Generate new private key → save as scripts/service-account.json
//   2. Add BUILDING_ID to .env.local  (or pass as first CLI arg)
//
// Run:
//   node scripts/seedEvent2025.js
// Or:
//   node scripts/seedEvent2025.js <buildingId>

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load env file for BUILDING_ID
for (const f of [".env.local", ".env"]) {
  try { process.loadEnvFile(f); } catch {}
}

const bid = process.env.BUILDING_ID || process.argv[2];
if (!bid) {
  console.error("Missing BUILDING_ID. Add to .env.local:\n  BUILDING_ID=your-building-id");
  console.error("Or: node scripts/seedEvent2025.js <buildingId>");
  process.exit(1);
}

const saPath = new URL("./service-account.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
} catch {
  console.error("Service account key not found at scripts/service-account.json");
  console.error("Download it: Firebase Console → Project settings → Service accounts → Generate new private key");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ts = (dateStr) => dateStr; // Events.jsx stores date as "YYYY-MM-DD" string
const eid = (p) => p + "_" + Math.random().toString(36).slice(2, 9);

// ── 21 Donations ─────────────────────────────────────────────────────────────
const donations = [
  { id: eid("d"), date: ts("2025-07-26"), name: "Previous Year Balance",                         flat: null, amount: 1562, type: "carryforward",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Laddu Velam Pata Amount by Sailesh Garu",        flat: null, amount: 4000, type: "velampata",     remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Small Laddu Velam Pata Amount by Saketh varma",  flat: null, amount: 3000, type: "velampata",     remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Contribution By Srinivasgaru",                   flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Contribution By Srinivasgaru Vamsi",             flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Contribution By Sailesh garu",                   flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Contribution By Chaitanya Garu",                 flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Contribution By Ramesh Garu",                    flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-10"), name: "Contribution By Ravikanth garu",                 flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-10"), name: "Contribution By Pradeep Garu",                   flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-19"), name: "Contribution By Jagadeesh garu",                 flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-19"), name: "Contribution By Dileep garu",                    flat: null, amount: 3000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-09"), name: "Vigraham by Nagarjuna Garu",                     flat: null, amount: 5200, type: "contra",        remarks: "Contra", isExternal: false },
  { id: eid("d"), date: ts("2025-08-22"), name: "Swami varu and Ayyavaru Vastraalu by Ramesh garu", flat: null, amount: 1435, type: "contra",      remarks: "Contra", isExternal: false },
  { id: eid("d"), date: ts("2025-08-24"), name: "Laddu by Anil Kumar",                            flat: null, amount: 1225, type: "contra",        remarks: "Contra", isExternal: false },
  { id: eid("d"), date: ts("2025-08-25"), name: "Contribution by Prabhakar garu",                 flat: null, amount: 1000, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-26"), name: "Contribution by Bhupendra Vasant Patre garu",    flat: null, amount: 1001, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-26"), name: "4 KGs Bantipoolu from common maintenance",       flat: null, amount:  500, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-08-27"), name: "11 Kobbari Kaayalu by Chaitanya garu",           flat: null, amount:  440, type: "contra",        remarks: "Contra", isExternal: false },
  { id: eid("d"), date: ts("2025-08-31"), name: "Oil amount by SriLakshmi garu",                  flat: null, amount:  350, type: "contribution",  remarks: "",       isExternal: false },
  { id: eid("d"), date: ts("2025-09-03"), name: "Additional contribution from 10 families",       flat: null, amount: 5848, type: "contribution",  remarks: "",       isExternal: false },
];

// ── 43 Expenses ──────────────────────────────────────────────────────────────
const expenses = [
  { id: eid("e"), date: ts("2025-08-09"), description: "Vigraham by 103",                              amount: 5200,  status: "donation", paidBy: "103", category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-22"), description: "Paints by 103",                               amount:  350,  status: "settled",  paidBy: "103", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-22"), description: "Pooja Samanlu Bill 1 by 301",                 amount: 1647,  status: "settled",  paidBy: "301", category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-22"), description: "Blouse piece and towel by 301",               amount:  250,  status: "settled",  paidBy: "301", category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-22"), description: "Swami varu and Ayyavaru Vastraalu by 503",    amount: 1435,  status: "donation", paidBy: "503", category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-22"), description: "Laddu Advance Paid to Vendor",                amount:  600,  status: "donation", paidBy: "",    category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-23"), description: "Blue Sheets by 201",                          amount:  900,  status: "settled",  paidBy: "201", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-23"), description: "Binding wire By 201",                         amount:   30,  status: "settled",  paidBy: "201", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-23"), description: "Paints by 201",                               amount:  125,  status: "settled",  paidBy: "201", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-24"), description: "Booking of 30 meals at 200 rupees paid to 302", amount: 6000, status: "settled", paidBy: "302", category: "food",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-26"), description: "Second Bill Poolu Pallu Patri etc by 301",    amount: 3079,  status: "settled",  paidBy: "301", category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-26"), description: "Mango Leaves by 302",                         amount:  200,  status: "settled",  paidBy: "302", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Pantulu garu",                                amount: 10116, status: "settled",  paidBy: "",    category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-27"), description: "Laddu Balance Amount to Vendor",              amount:  615,  status: "donation", paidBy: "",    category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Avupalu By 402",                              amount:  128,  status: "settled",  paidBy: "402", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Morning Tiffins amount Paid to 402",          amount: 2300,  status: "settled",  paidBy: "402", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Morning Tea amount Paid to 301",              amount:  400,  status: "settled",  paidBy: "301", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Ribbons to 302",                              amount:   60,  status: "settled",  paidBy: "302", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Kids Play Items Horns to 103",                amount:  215,  status: "settled",  paidBy: "103", category: "misc",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Thread and Other Items to 103",               amount:  190,  status: "settled",  paidBy: "103", category: "misc",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Utti Pots 6 to 103",                          amount:  800,  status: "settled",  paidBy: "103", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Paper Plates Big to 201",                     amount:   90,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Paper Plates Medium to 201",                  amount:  605,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Water Glasses Big to 201",                    amount:  200,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Water Glasses Medium to 201",                 amount:   80,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Bananas to 201",                              amount:  200,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Bislery Cans to 201",                         amount:  200,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Note Books to 201",                           amount:  345,  status: "settled",  paidBy: "201", category: "misc",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Pencils to 201",                              amount:   83,  status: "settled",  paidBy: "201", category: "misc",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Juice and Coconut to 201",                    amount:  380,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Paper Plates",                                amount:   25,  status: "settled",  paidBy: "",    category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "10 Meters Speaker wire to 202",               amount:  150,  status: "settled",  paidBy: "202", category: "stage",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Mic and Mic wire to 202",                     amount:  600,  status: "settled",  paidBy: "202", category: "stage",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Coconut for Kalasam to 402",                  amount:   21,  status: "settled",  paidBy: "402", category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Coins per Panthulau gari List",               amount:   32,  status: "settled",  paidBy: "",    category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Auto Charges for meals to 302",               amount:  500,  status: "settled",  paidBy: "302", category: "transport",  remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Coconut donation by 402",                     amount:  440,  status: "donation", paidBy: "402", category: "pooja",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Night Tiffins to vendor and 303",             amount: 2600,  status: "settled",  paidBy: "303", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Side curtains Flowers and Garlands by 301",   amount: 1450,  status: "settled",  paidBy: "301", category: "decoration", remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Evening Tea to 503",                          amount:  300,  status: "settled",  paidBy: "503", category: "food",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Abraham Wage Paid to 201",                    amount:  800,  status: "settled",  paidBy: "201", category: "misc",       remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Stage and Carpet with Transport",             amount: 8710,  status: "settled",  paidBy: "",    category: "stage",      remarks: "" },
  { id: eid("e"), date: ts("2025-08-31"), description: "Water bottle and Paper plates by 201",        amount:  110,  status: "settled",  paidBy: "201", category: "food",       remarks: "" },
];

// ── 4 Receivables ─────────────────────────────────────────────────────────────
const receivables = [
  { id: eid("r"), description: "Laddu Velam Pata amount from 202",         flat: "202", amount: 30000, status: "pending" },
  { id: eid("r"), description: "Chinna Laddu velam pata amount from 103",  flat: "103", amount: 18000, status: "pending" },
  { id: eid("r"), description: "Vasthraalu Velampata amount from 402",     flat: "402", amount:  1200, status: "pending" },
  { id: eid("r"), description: "Vigraham from 201 (Approximate Amount)",   flat: "201", amount:  5500, status: "pending" },
];

const totalDonations = donations.reduce((s, d) => s + d.amount, 0);
const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0);
const closingBalance = totalDonations - totalExpenses; // 52561 - 52561 = 0

const now = Date.now();
const event = {
  name: "SR Gold Vinayaka Chaviti Utsavaalu 2025",
  year: 2025,
  status: "closed",
  targetAmount: 0,
  openingBalance: 1562,
  closingBalance,
  donations,
  expenses,
  receivables,
  createdAt: new Date("2025-08-01").getTime(),
  updatedAt: new Date("2025-09-05").getTime(),
  closedAt:  new Date("2025-09-05").getTime(),
};

async function main() {
  const ref = db.collection("buildings").doc(bid).collection("events").doc();
  console.log(`Writing event to buildings/${bid}/events/${ref.id}…`);
  console.log(`  Donations : ${donations.length}  (total ₹${totalDonations.toLocaleString("en-IN")})`);
  console.log(`  Expenses  : ${expenses.length}  (total ₹${totalExpenses.toLocaleString("en-IN")})`);
  console.log(`  Receivables: ${receivables.length}`);
  console.log(`  Closing balance: ₹${closingBalance}`);

  await ref.set(event);
  console.log("Done. Event seeded successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
