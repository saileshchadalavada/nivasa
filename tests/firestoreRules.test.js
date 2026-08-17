/* SEC-10 Firestore rules matrix.
   Requires the Firestore emulator on 127.0.0.1:8080. Run:
     firebase emulators:exec --only firestore "npm run test -- firestoreRules"
   or start the emulator separately and run `vitest run tests/firestoreRules`.

   Skipped automatically if FIRESTORE_EMULATOR_HOST is not set. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, writeBatch } from "firebase/firestore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(HERE, "..", "firestore.rules");
const emulatorConfigured = !!process.env.FIRESTORE_EMULATOR_HOST;

const describeIfEmulator = emulatorConfigured ? describe : describe.skip;

describeIfEmulator("firestore.rules — SEC-10 matrix", () => {
  let env;
  const PROJECT_ID = "nivasa-rules-test";

  const seedBuilding = async ({ bid, adminUid, inviteCode = "ABC123", members = {} }) => {
    // Use security-rules-bypass context to prepare state.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "buildings", bid), {
        name: "Test Building",
        adminUid,
        inviteCode,
        createdAt: Date.now(),
      });
      await setDoc(doc(db, "publicBuildings", bid), {
        name: "Test Building",
        city: "Hyderabad",
        state: "TG",
        type: "single",
      });
      for (const [uid, data] of Object.entries(members)) {
        await setDoc(doc(db, "buildings", bid, "members", uid), {
          username: data.username || "member",
          flat: data.flat ?? null,
          roles: data.roles || [],
          residentType: data.residentType || "owner",
          phone: data.phone ?? null,
          joinedAt: Date.now(),
        });
      }
    });
  };

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(RULES_PATH, "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  /* ---------- READ: buildings/{bid} ---------- */

  it("denies unauthenticated read of buildings/{bid}", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA" });
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "buildings", "b1")));
  });

  it("denies authenticated non-member read of buildings/{bid}", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA" });
    const db = env.authenticatedContext("outsider").firestore();
    await assertFails(getDoc(doc(db, "buildings", "b1")));
  });

  it("denies read of a different building's private config", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA", members: { userX: {} } });
    await seedBuilding({ bid: "b2", adminUid: "adminB" });
    const db = env.authenticatedContext("userX").firestore();
    await assertFails(getDoc(doc(db, "buildings", "b2")));
  });

  it("denies listing the buildings collection to any user", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA", members: { userX: {} } });
    const db = env.authenticatedContext("userX").firestore();
    await assertFails(getDocs(collection(db, "buildings")));
  });

  it("allows admin to read own building", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA" });
    const db = env.authenticatedContext("adminA").firestore();
    await assertSucceeds(getDoc(doc(db, "buildings", "b1")));
  });

  it("allows an existing member to read own building", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA", members: { userX: {} } });
    const db = env.authenticatedContext("userX").firestore();
    await assertSucceeds(getDoc(doc(db, "buildings", "b1")));
  });

  /* ---------- publicBuildings/{bid} ---------- */

  it("allows unauthenticated read of publicBuildings/{bid}", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA" });
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "publicBuildings", "b1")));
  });

  it("allows non-member read of publicBuildings/{bid}", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA" });
    const db = env.authenticatedContext("outsider").firestore();
    await assertSucceeds(getDoc(doc(db, "publicBuildings", "b1")));
  });

  /* ---------- members create ---------- */

  it("denies authenticated non-member from self-creating their own membership", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA" });
    const db = env.authenticatedContext("intruder").firestore();
    await assertFails(setDoc(doc(db, "buildings", "b1", "members", "intruder"), {
      username: "intruder",
      flat: null,
      roles: [],
      residentType: "owner",
      joinedAt: Date.now(),
    }));
  });

  it("denies guest self-join by submitting residentType=guest", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA" });
    const db = env.authenticatedContext("intruder").firestore();
    await assertFails(setDoc(doc(db, "buildings", "b1", "members", "intruder"), {
      username: "intruder",
      flat: null,
      roles: [],
      residentType: "guest",
      joinedAt: Date.now(),
    }));
  });

  it("denies non-admin member from creating another member", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA", members: { userX: {} } });
    const db = env.authenticatedContext("userX").firestore();
    await assertFails(setDoc(doc(db, "buildings", "b1", "members", "userY"), {
      username: "userY",
      flat: null,
      roles: [],
      residentType: "owner",
      joinedAt: Date.now(),
    }));
  });

  it("allows admin to create a new member", async () => {
    await seedBuilding({ bid: "b1", adminUid: "adminA", members: { adminA: { roles: [] } } });
    const db = env.authenticatedContext("adminA").firestore();
    await assertSucceeds(setDoc(doc(db, "buildings", "b1", "members", "userY"), {
      username: "userY",
      flat: null,
      roles: [],
      residentType: "owner",
      joinedAt: Date.now(),
    }));
  });

  /* ---------- founder atomic setup ---------- */

  /* ---------- SEC-11: guests must not read private building ---------- */

  it("denies a guest reading the private building doc (SEC-11 tighten of SEC-10)", async () => {
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: { guestX: { residentType: "guest" } },
    });
    const db = env.authenticatedContext("guestX").firestore();
    await assertFails(getDoc(doc(db, "buildings", "b1")));
  });

  it("still allows an owner/tenant resident to read the private building doc", async () => {
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: { tenantX: { residentType: "tenant" } },
    });
    const db = env.authenticatedContext("tenantX").firestore();
    await assertSucceeds(getDoc(doc(db, "buildings", "b1")));
  });

  it("guest cannot list the members roster", async () => {
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: {
        guestX: { residentType: "guest" },
        otherY: { residentType: "owner" },
      },
    });
    const db = env.authenticatedContext("guestX").firestore();
    await assertFails(getDocs(collection(db, "buildings", "b1", "members")));
  });

  it("guest can read their own membership doc", async () => {
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: { guestX: { residentType: "guest" } },
    });
    const db = env.authenticatedContext("guestX").firestore();
    await assertSucceeds(getDoc(doc(db, "buildings", "b1", "members", "guestX")));
  });

  it("guest cannot read flats", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "buildings", "b1", "flats", "101"), { flat: "101", isCommon: false, claimedByUid: null });
    });
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: { guestX: { residentType: "guest" } },
    });
    const db = env.authenticatedContext("guestX").firestore();
    await assertFails(getDoc(doc(db, "buildings", "b1", "flats", "101")));
  });

  it("guest cannot read water periods", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "buildings", "b1", "waterPeriods", "seed"), { periodStart: "", periodEnd: "" });
    });
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: { guestX: { residentType: "guest" } },
    });
    const db = env.authenticatedContext("guestX").firestore();
    await assertFails(getDoc(doc(db, "buildings", "b1", "waterPeriods", "seed")));
  });

  it("guest cannot read full event doc, but can read the event summary", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "buildings", "b1", "events", "ev1"), {
        name: "Test", year: 2026, status: "active",
        donations: [{ amount: 100 }], expenses: [], receivables: [],
        createdAt: 1, updatedAt: 1,
      });
      await setDoc(doc(db, "buildings", "b1", "eventSummaries", "ev1"), {
        name: "Test", year: 2026, status: "active",
        collectedTotal: 100, spentTotal: 0, balance: 100, donorCount: 1, expenseCount: 0, updatedAt: 1,
      });
    });
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: { guestX: { residentType: "guest" } },
    });
    const db = env.authenticatedContext("guestX").firestore();
    await assertFails(getDoc(doc(db, "buildings", "b1", "events", "ev1")));
    await assertSucceeds(getDoc(doc(db, "buildings", "b1", "eventSummaries", "ev1")));
  });

  it("guestInvites are entirely client-blocked (read + write)", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "buildings", "b1", "guestInvites", "hash123"), { status: "active", allowedSections: ["events"], maxUses: 10, usedCount: 0 });
    });
    await seedBuilding({
      bid: "b1",
      adminUid: "adminA",
      members: { adminA: { roles: ["admin"] }, ownerX: { residentType: "owner" } },
    });
    const adminDb = env.authenticatedContext("adminA").firestore();
    const ownerDb = env.authenticatedContext("ownerX").firestore();
    await assertFails(getDoc(doc(adminDb, "buildings", "b1", "guestInvites", "hash123")));
    await assertFails(getDoc(doc(ownerDb, "buildings", "b1", "guestInvites", "hash123")));
    await assertFails(setDoc(doc(adminDb, "buildings", "b1", "guestInvites", "new"), { status: "active", allowedSections: ["events"] }));
  });

  it("allows founder atomic building setup batch", async () => {
    const founderUid = "founder-1";
    const db = env.authenticatedContext(founderUid).firestore();
    const bid = "b-new";
    const batch = writeBatch(db);
    batch.set(doc(db, "publicBuildings", bid), {
      name: "New Building",
      city: "Hyderabad",
      state: "TG",
      type: "single",
    });
    batch.set(doc(db, "buildings", bid), {
      name: "New Building",
      adminUid: founderUid,
      inviteCode: "XYZ789",
      createdAt: Date.now(),
    });
    batch.set(doc(db, "buildings", bid, "flats", "101"), {
      flat: "101",
      floor: 1,
      unit: 1,
      isCommon: false,
      claimedByUid: null,
    });
    batch.set(doc(db, "buildings", bid, "members", founderUid), {
      username: "founder",
      flat: null,
      roles: [],
      residentType: "owner",
      joinedAt: Date.now(),
    });
    await assertSucceeds(batch.commit());
  });
});
