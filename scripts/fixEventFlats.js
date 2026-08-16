// Fix flat numbers and isExternal flags in both event documents
// Run: node scripts/fixEventFlats.js
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

// Ordered rules: first match wins — put multi-word / ambiguous names FIRST
const RULES = [
  // Vamsi before Srinivas — "Srinivasgaru Vamsi" must match Vamsi (202) not Srinivas (501)
  { match: "vamsi",       flat: "202", isExternal: false },
  // Externals
  { match: "bhavani",     flat: null,  isExternal: true  },
  { match: "shiva",       flat: null,  isExternal: true  },  // Shiva Shankar Garu
  { match: "bhupendra",   flat: null,  isExternal: true  },
  { match: "srilakshmi",  flat: null,  isExternal: true  },
  { match: "sri lakshmi", flat: null,  isExternal: true  },
  { match: "saketh",      flat: null,  isExternal: true  },
  { match: "anil",        flat: null,  isExternal: true  },
  // Residents
  { match: "srinivas",    flat: "501", isExternal: false },
  { match: "nagarjuna",   flat: "103", isExternal: false },
  { match: "jagade",      flat: "101", isExternal: false },  // Jagadeesh / Jagadish
  { match: "sailesh",     flat: "301", isExternal: false },
  { match: "ramesh",      flat: "503", isExternal: false },
  { match: "chaitanya",   flat: "402", isExternal: false },
  { match: "pradeep",     flat: "502", isExternal: false },
  { match: "ravikanth",   flat: "201", isExternal: false },
  { match: "dileep",      flat: "401", isExternal: false },
  { match: "prabhakar",   flat: "102", isExternal: false },
];

function applyRule(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const rule of RULES) {
    if (lower.includes(rule.match)) return rule;
  }
  return null;
}

async function fixEvent(doc) {
  const data = doc.data();
  const donations = data.donations || [];
  let changed = 0;

  const updated = donations.map((d) => {
    const rule = applyRule(d.name);
    if (!rule) return d;
    const unchanged = d.flat === rule.flat && d.isExternal === rule.isExternal;
    if (unchanged) return d;
    changed++;
    const newType = rule.isExternal && d.type === "contribution" ? "external" : d.type;
    return { ...d, flat: rule.flat, isExternal: rule.isExternal, type: newType };
  });

  if (changed === 0) {
    console.log(`  ${data.name || doc.id}: no changes needed`);
    return;
  }

  await doc.ref.update({ donations: updated });
  console.log(`  ${data.name || doc.id}: patched ${changed} donation(s)`);
}

async function main() {
  const snap = await db.collection("buildings").doc(bid).collection("events").get();
  if (snap.empty) { console.log("No events found."); process.exit(0); }
  console.log(`Found ${snap.docs.length} event(s)`);
  for (const doc of snap.docs) console.log(`  - ${doc.data().name || doc.id} (${doc.id})`);
  console.log();
  for (const doc of snap.docs) await fixEvent(doc);
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => { console.error("Fix failed:", err.message || err); process.exit(1); });
