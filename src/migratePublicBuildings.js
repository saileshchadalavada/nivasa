/* SEC-03 migration: create publicBuildings/{bid} docs from existing buildings.
   Run this ONCE before deploying the rule that restricts buildings/{bid} read.

   Usage (from browser console while signed in as admin):
     import { migrateToPublicBuildings } from './data';
     await migrateToPublicBuildings();

   Or call it from an admin button in the app. */

import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function migrateToPublicBuildings() {
  const buildingsSnap = await getDocs(collection(db, "buildings"));
  let created = 0, skipped = 0;

  for (const bDoc of buildingsSnap.docs) {
    const bid = bDoc.id;
    const data = bDoc.data();

    // Check if public doc already exists
    const pubRef = doc(db, "publicBuildings", bid);
    const pubSnap = await getDoc(pubRef);
    if (pubSnap.exists()) {
      skipped++;
      continue;
    }

    // Write only public discovery fields
    await setDoc(pubRef, {
      name: data.name || "",
      city: data.city || "",
      state: data.state || "",
      type: data.type || "single",
    });
    created++;
  }

  console.log(`Migration complete: ${created} created, ${skipped} already existed.`);
  return { created, skipped };
}
