/* Firestore access layer — multi-building, with SEPARATE water & maintenance
   billing-period streams (different people, different cycles).
   buildings/{bid}/waterPeriods/{id}  { periodStart, periodEnd, genCount, genRate,
                                         manCount, manRate, connBill, readings, createdAt }
   buildings/{bid}/maintPeriods/{id}  { periodStart, periodEnd, expenses, createdAt }
   Paid state is tracked via buildings/{bid}.payments[] (see recordPayment). */
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, writeBatch, query, arrayUnion, arrayRemove,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { buildFlatsForSetup, buildSeedWater, buildSeedMaint, nextMonthBounds } from "./seedData";
import { WATER_2026 } from "./historicalWaterPeriods";

const userRef = (uid) => doc(db, "users", uid);
const bldRef = (bid) => doc(db, "buildings", bid);
const flatRef = (bid, f) => doc(db, "buildings", bid, "flats", f);
const flatsCol = (bid) => collection(db, "buildings", bid, "flats");
const membersCol = (bid) => collection(db, "buildings", bid, "members");
const memberRef = (bid, uid) => doc(db, "buildings", bid, "members", uid);
const waterCol = (bid) => collection(db, "buildings", bid, "waterPeriods");
const waterRef = (bid, id) => doc(db, "buildings", bid, "waterPeriods", id);
const maintCol = (bid) => collection(db, "buildings", bid, "maintPeriods");
const maintRef = (bid, id) => doc(db, "buildings", bid, "maintPeriods", id);
const presetsCol = (bid) => collection(db, "buildings", bid, "costPresets");
const activitiesCol = (bid) => collection(db, "buildings", bid, "activities");
const activityRef = (bid, id) => doc(db, "buildings", bid, "activities", id);
const presetRef = (bid, id) => doc(db, "buildings", bid, "costPresets", id);
const eventsCol = (bid) => collection(db, "buildings", bid, "events");
const eventRef = (bid, id) => doc(db, "buildings", bid, "events", id);
const eventSummariesCol = (bid) => collection(db, "buildings", bid, "eventSummaries");
const eventSummaryRef = (bid, id) => doc(db, "buildings", bid, "eventSummaries", id);
const votesCol = (bid, aid) => collection(db, "buildings", bid, "activities", aid, "votes");
const voteRef = (bid, aid, uid) => doc(db, "buildings", bid, "activities", aid, "votes", uid);
const publicBldRef = (bid) => doc(db, "publicBuildings", bid);

/* ---- member shape validation (HIGH-03) ---- */
const VALID_MEMBER_ROLES = new Set(["admin", "treasurer", "water"]);
const VALID_RESIDENT_TYPES = new Set(["owner", "tenant", "guest"]);
const ALLOWED_MEMBER_KEYS = new Set(["username", "flat", "roles", "residentType", "phone", "joinedAt"]);

function validateMemberShape(data) {
  if (!data || typeof data !== "object") throw new Error("member-invalid-shape");
  for (const k of Object.keys(data)) {
    if (!ALLOWED_MEMBER_KEYS.has(k)) throw new Error(`member-unknown-field:${k}`);
  }
  if (typeof data.username !== "string" || data.username.length < 1 || data.username.length > 50)
    throw new Error("member-invalid-username");
  if (data.flat !== null && typeof data.flat !== "string")
    throw new Error("member-invalid-flat");
  if (!Array.isArray(data.roles) || !data.roles.every((r) => VALID_MEMBER_ROLES.has(r)))
    throw new Error("member-invalid-roles");
  if (!VALID_RESIDENT_TYPES.has(data.residentType))
    throw new Error("member-invalid-residentType");
  if (data.phone !== null && typeof data.phone !== "string")
    throw new Error("member-invalid-phone");
  if (typeof data.joinedAt !== "number")
    throw new Error("member-invalid-joinedAt");
}

/* Strips immutable fields (joinedAt, username) from the patch, reads the
   current member doc, merges, validates the full shape, then writes only
   the safe patch. Firestore rules enforce the same constraints server-side. */
export async function updateMemberValidated(bid, uid, patch) {
  const { joinedAt: _j, username: _u, ...safePatch } = patch;
  const snap = await getDoc(memberRef(bid, uid));
  if (!snap.exists()) throw new Error("membership-not-found");
  const existing = snap.data();
  const merged = { ...existing, ...safePatch };
  validateMemberShape(merged);
  await updateDoc(memberRef(bid, uid), safePatch);
}

/* ---- account ---- */
export const subscribeAccount = (uid, cb) =>
  onSnapshot(userRef(uid), (s) => cb(s.exists() ? s.data() : null));
export async function ensureAccount(uid, username) {
  const s = await getDoc(userRef(uid));
  if (!s.exists()) await setDoc(userRef(uid), { username, buildings: [], createdAt: Date.now() });
}

/* SEC-01: allow the signed-in user to remove a stale building ID from their own
   account. Safe because Firestore rules restrict /users/{u} updates to uid() == u
   and only allow changes to the buildings field. */
export function removeOwnBuildingReference(uid, bid) {
  return updateDoc(userRef(uid), {
    buildings: arrayRemove(bid),
  });
}

/* ---- building config (public read) ---- */
export const subscribeBuilding = (bid, cb) =>
  onSnapshot(bldRef(bid), (s) => cb(s.exists() ? { id: bid, ...s.data() } : null));
export async function getBuilding(bid) {
  const s = await getDoc(bldRef(bid));
  return s.exists() ? { id: bid, ...s.data() } : null;
}


/* SEC-03: read minimal building info without membership.
   Used by Join and Auth screens before the user is a member. */
export async function getPublicBuilding(bid) {
  const s = await getDoc(publicBldRef(bid));
  return s.exists() ? { id: bid, ...s.data() } : null;
}

export async function createBuilding({ details, floors, perFloor, adminUid, username, prefill = false }) {
  const bref = doc(collection(db, "buildings"));
  const bid = bref.id;
  const flats = buildFlatsForSetup(floors, perFloor, prefill);
  const batch = writeBatch(db);
  // SEC-03: write public discovery doc (name, city, state only)
  batch.set(publicBldRef(bid), { name: details.name || "", city: details.city || "", state: details.state || "", type: "single" });
  batch.set(bref, { ...details, type: "single", floors, perFloor, adminUid, inviteCode: makeCode(),
    seededSrGold: !!prefill, createdAt: Date.now() });
  flats.forEach((f) => batch.set(flatRef(bid, f.flat), f));
  batch.set(waterRef(bid, "seed"), { ...buildSeedWater(flats, prefill), createdAt: Date.now(), updatedAt: Date.now() });
  batch.set(maintRef(bid, "seed"), { ...buildSeedMaint(prefill), createdAt: Date.now(), updatedAt: Date.now() });
  batch.set(memberRef(bid, adminUid), { username, flat: null, roles: [], residentType: "owner", joinedAt: Date.now() });
  batch.update(userRef(adminUid), { buildings: arrayUnion(bid) });
  await batch.commit();
  return bid;
}
export const updateBuilding = async (bid, patch) => {
  await updateDoc(bldRef(bid), patch);
  // SEC-03: sync public-facing fields to publicBuildings if changed
  const publicFields = {};
  if ("name" in patch) publicFields.name = patch.name;
  if ("city" in patch) publicFields.city = patch.city;
  if ("state" in patch) publicFields.state = patch.state;
  if (Object.keys(publicFields).length > 0) {
    try { await updateDoc(publicBldRef(bid), publicFields); } catch (e) { console.error("Could not sync public building:", e); }
  }
};

/* ---- membership / join ---- */

/* SEC-10: Invite-based membership creation now runs on a trusted server
   endpoint (/api/join-building). Browser clients can NOT write to
   buildings/{bid}/members directly — firestore.rules blocks it.
   The endpoint verifies the Firebase ID token, checks the invite code
   against the private building doc, and atomically creates the membership
   and updates users/{uid}.buildings. Throws an Error whose .code matches
   the API error contract (INVALID_INVITE_CODE, BUILDING_NOT_FOUND, etc.). */
export async function joinBuildingByInvite(bid, inviteCode) {
  return postJsonWithIdToken("/api/join-building", { bid, inviteCode });
}

/* SEC-11: Create a shareable family-guest invitation URL. Authorized for
   admin / owner / tenant members; guests cannot generate invites. Returns
   { url, expiresAt, maxUses } from the trusted server endpoint. */
export async function createGuestInvite({ bid, targetSection, eventId = null }) {
  return postJsonWithIdToken("/api/create-guest-invite", {
    bid,
    targetSection,
    eventId: eventId || undefined,
  });
}

/* SEC-11: Enroll the signed-in user as a family guest via a guest token
   captured from the invite URL. The server validates the token, section
   and event scope, then creates a guest membership. Never writes to
   Firestore directly from the browser. */
export async function joinBuildingAsGuestByInvite({ bid, guestToken, targetSection, eventId = null }) {
  return postJsonWithIdToken("/api/join-building-guest", {
    bid,
    guestToken,
    targetSection,
    eventId: eventId || undefined,
  });
}

async function postJsonWithIdToken(path, body) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const err = new Error("Not signed in");
    err.code = "UNAUTHENTICATED";
    throw err;
  }
  const idToken = await currentUser.getIdToken();
  let resp;
  try {
    resp = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    const err = new Error("Network error");
    err.code = "NETWORK_ERROR";
    throw err;
  }
  let data = null;
  try { data = await resp.json(); } catch { /* ignore parse errors */ }
  if (!resp.ok) {
    const code = (data && data.error) || "INTERNAL";
    const err = new Error(code);
    err.code = code;
    throw err;
  }
  return data;
}
export const subscribeMembership = (bid, uid, cb) =>
  onSnapshot(memberRef(bid, uid),
    (s) => cb(s.exists() ? { uid, ...s.data() } : null),
    (err) => { console.error("subscribeMembership:", err.code); cb(null); });
export const subscribeMembers = (bid, cb) =>
  onSnapshot(query(membersCol(bid)), (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))));
export const setMemberFlat = (bid, uid, flat) => updateDoc(memberRef(bid, uid), { flat });
export const setMemberRoles = (bid, uid, roles) => updateMemberValidated(bid, uid, { roles });
export const updateMembership = (bid, uid, patch) => updateMemberValidated(bid, uid, patch);

/* Admin flat assignment: atomically updates the member doc AND both flat docs
   (clears claimedByUid on the old flat, sets it on the new one). */
export async function adminAssignFlat(bid, uid, newFlat, oldFlat) {
  const batch = writeBatch(db);
  batch.update(memberRef(bid, uid), { flat: newFlat || null });
  if (oldFlat && oldFlat !== newFlat) {
    batch.update(flatRef(bid, oldFlat), { claimedByUid: null });
  }
  if (newFlat && newFlat !== oldFlat) {
    batch.update(flatRef(bid, newFlat), { claimedByUid: uid });
  }
  await batch.commit();
}

/* ---- flats ---- */
export const subscribeFlats = (bid, cb) =>
  onSnapshot(query(flatsCol(bid)), (snap) => cb(snap.docs.map((d) => d.data())));
export const claimFlatWithDetails = (bid, flat, uid, details) =>
  updateDoc(flatRef(bid, flat), { ...details, claimedByUid: uid });
/* Set a flat's meter serial (lives on the flat, shared across all periods). */
export const setFlatMeter = (bid, flat, meter) => updateDoc(flatRef(bid, flat), { meter });

/* SEC-07 / DB-04: atomic flat claim — transaction ensures flat+member update
   succeeds or fails together. No partial state. */
export async function claimFlat({ bid, uid, flat, name, meter, residentType, phone }) {
  const selectedFlatRef = flatRef(bid, flat);
  const selectedMemberRef = memberRef(bid, uid);

  await runTransaction(db, async (transaction) => {
    const [flatSnap, memberSnap] = await Promise.all([
      transaction.get(selectedFlatRef),
      transaction.get(selectedMemberRef),
    ]);

    if (!flatSnap.exists()) throw new Error("flat-not-found");
    if (!memberSnap.exists()) throw new Error("membership-not-found");

    const flatData = flatSnap.data();
    const memberData = memberSnap.data();

    if (flatData.isCommon) throw new Error("common-flat-not-allowed");
    if (flatData.claimedByUid && flatData.claimedByUid !== uid) throw new Error("flat-already-claimed");
    if (memberData.flat && memberData.flat !== flat) throw new Error("member-already-has-flat");

    transaction.update(selectedFlatRef, {
      claimedByUid: uid,
      name: name.trim(),
      meter: meter.trim(),
    });

    transaction.update(selectedMemberRef, {
      flat,
      residentType,
      phone: phone?.trim() || null,
    });
  });
}

/* DB-05: atomic admin flat assignment — validates target is not occupied
   by another member before reassigning. */
export async function assignMemberFlat({ bid, memberUid, oldFlat, newFlat }) {
  await runTransaction(db, async (transaction) => {
    const memberDocument = memberRef(bid, memberUid);
    const memberSnap = await transaction.get(memberDocument);

    if (!memberSnap.exists()) throw new Error("membership-not-found");

    let targetRef = null;

    if (newFlat) {
      targetRef = flatRef(bid, newFlat);
      const targetSnap = await transaction.get(targetRef);

      if (!targetSnap.exists()) throw new Error("flat-not-found");

      const target = targetSnap.data();
      if (target.isCommon) throw new Error("common-flat-not-allowed");
      if (target.claimedByUid && target.claimedByUid !== memberUid) {
        throw new Error("flat-already-claimed");
      }
    }

    if (oldFlat && oldFlat !== newFlat) {
      transaction.update(flatRef(bid, oldFlat), { claimedByUid: null });
    }

    if (targetRef) {
      transaction.update(targetRef, { claimedByUid: memberUid });
    }

    transaction.update(memberDocument, { flat: newFlat || null });
  });
}

/* ---- WATER periods ---- */
export const subscribeWaterPeriods = (bid, cb) =>
  onSnapshot(query(waterCol(bid)), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
export const saveWaterPeriod = (bid, id, data) => {
  const { id: _d, ...body } = data;
  return setDoc(waterRef(bid, id), { ...body, updatedAt: Date.now() });
};
export const deleteWaterPeriod = (bid, id) => deleteDoc(waterRef(bid, id));
/* ---- COST PRESETS ---- */
export const subscribeCostPresets = (bid, cb) =>
  onSnapshot(query(presetsCol(bid)), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
export async function saveCostPreset(bid, preset) {
  if (preset.id) {
    const { id, ...body } = preset;
    await updateDoc(presetRef(bid, id), { ...body, updatedAt: Date.now() });
    return id;
  }
  const ref = doc(presetsCol(bid));
  await setDoc(ref, { ...preset, createdAt: Date.now(), updatedAt: Date.now() });
  return ref.id;
}
export const deleteCostPreset = (bid, id) => deleteDoc(presetRef(bid, id));

/* new blank water period; opening readings carry from last closing.
   costItems (if present) carry forward with qty zeroed for re-entry. */
export async function startNextWaterPeriod(bid, current) {
  const readings = {};
  Object.entries(current.readings || {}).forEach(([flat, r]) => {
    readings[flat] = { prev: r.curr || 0, curr: "", adj: 0 };
  });
  // carry forward cost item structure (description + rate + split) with qty zeroed
  const costItems = (current.costItems || []).map((ci) => ({
    ...ci, quantity: "", id: "ci_" + Math.random().toString(36).slice(2, 8),
  }));
  const ref = doc(waterCol(bid));
  await setDoc(ref, {
    periodStart: "", periodEnd: "",
    // keep legacy fields for backward compat
    genCount: "", genRate: "", manCount: "", manRate: "", connBill: "",
    costItems,
    readings, createdAt: Date.now(), updatedAt: Date.now(),
  });
  return ref.id;
}

/* ---- MAINTENANCE periods ---- */
export const subscribeMaintPeriods = (bid, cb) =>
  onSnapshot(query(maintCol(bid)), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
export const saveMaintPeriod = (bid, id, data) => {
  const { id: _d, ...body } = data;
  return setDoc(maintRef(bid, id), { ...body, updatedAt: Date.now() });
};
export const deleteMaintPeriod = (bid, id) => deleteDoc(maintRef(bid, id));

/* Mark a period as published (a shareable snapshot; re-publishable on updates). */
export const publishPeriod = (bid, coll, id, uid) =>
  updateDoc(doc(db, "buildings", bid, coll, id), { publishedAt: Date.now(), publishedBy: uid });
/* new maintenance period defaulting to the NEXT calendar month.
   Only items flagged recurring carry forward (with their amounts); one-offs drop. */
export async function startNextMaintPeriod(bid, current) {
  const b = nextMonthBounds(current.periodStart || current.periodEnd);
  const expenses = (current.expenses || []);
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const charge = current.chargePerFlat != null ? Number(current.chargePerFlat) : null;
  const prevCarry = Number(current.carryForward || 0);

  // Get actual flat count and building config
  const [bldSnap, flatsSnap] = await Promise.all([getDoc(bldRef(bid)), getDocs(flatsCol(bid))]);
  const bldData = bldSnap.exists() ? bldSnap.data() : {};
  const nFlats = flatsSnap.docs.filter((d) => !d.data().isCommon).length || 1;
  const corpus = bldData.corpus || {};
  const corpusMonthly = Number(corpus.monthly || 0);

  // FIN-06: surplus = maintenance collections - maintenance expenses.
  // Corpus is billed and deposited separately; it does not reduce maintenance surplus.
  const surplus = charge != null ? (charge * nFlats - total) + prevCarry : prevCarry;

  // Auto-deposit monthly corpus when closing a period
  if (corpusMonthly > 0) {
    const closingLabel = current.periodStart ? new Date(current.periodStart + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "period";
    const deposit = {
      id: "cm_" + Math.random().toString(36).slice(2, 8),
      type: "deposit",
      amount: corpusMonthly * nFlats,
      description: `Monthly corpus — ${closingLabel} (₹${corpusMonthly} × ${nFlats} flats)`,
      date: new Date().toISOString().slice(0, 10),
      auto: true,
    };
    await updateDoc(bldRef(bid), { corpus: { ...corpus, ledger: [...(corpus.ledger || []), deposit] } });
  }

  const ref = doc(maintCol(bid));
  await setDoc(ref, {
    periodStart: b.start, periodEnd: b.end,
    expenses: expenses.filter((e) => e.recurring).map((e) => ({ ...e })),
    chargePerFlat: null,
    carryForward: surplus,
    createdAt: Date.now(), updatedAt: Date.now(),
  });
  return ref.id;
}

/* One-time: turn the baked-in 2026 water history into real editable periods.
   Skips any month whose start date already exists. Ordered chronologically. */
export async function backfillWater2026(bid, existingStarts = []) {
  const batch = writeBatch(db);
  let n = 0;
  Object.values(WATER_2026).forEach((p) => {
    if (existingStarts.includes(p.periodStart)) return;
    const ref = doc(waterCol(bid));
    batch.set(ref, { ...p, createdAt: Date.parse(p.periodStart), updatedAt: Date.now() });
    n++;
  });
  batch.update(bldRef(bid), { water2026Imported: true });
  await batch.commit();
  return n;
}

function makeCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

/* Self-heal: if a building has no periods yet (e.g. created before the
   water/maintenance split), create a blank starter so the app never hangs. */
export async function ensureWaterPeriod(bid, flats) {
  const ref = doc(waterCol(bid));
  await setDoc(ref, { ...buildSeedWater(flats, false), createdAt: Date.now(), updatedAt: Date.now() });
}
export async function ensureMaintPeriod(bid) {
  const ref = doc(maintCol(bid));
  await setDoc(ref, { ...buildSeedMaint(false), createdAt: Date.now(), updatedAt: Date.now() });
}

/* Add a fresh blank period (for backfilling a past month or adding any period).
   Returns the new id so the caller can select it for editing. */
export async function addWaterPeriod(bid, flats) {
  const ref = doc(waterCol(bid));
  await setDoc(ref, { ...buildSeedWater(flats, false), createdAt: Date.now(), updatedAt: Date.now() });
  return ref.id;
}
export async function addMaintPeriod(bid) {
  const ref = doc(maintCol(bid));
  await setDoc(ref, { periodStart: "", periodEnd: "", expenses: [], createdAt: Date.now(), updatedAt: Date.now() });
  return ref.id;
}

/* ---- ACTIVITIES (announcements, polls, meetings) ---- */
export const subscribeActivities = (bid, cb) =>
  onSnapshot(query(activitiesCol(bid)), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
export async function createActivity(bid, activity) {
  const ref = doc(activitiesCol(bid));
  await setDoc(ref, { ...activity, createdAt: Date.now(), updatedAt: Date.now() });
  return ref.id;
}
export const updateActivity = (bid, id, patch) =>
  updateDoc(activityRef(bid, id), { ...patch, updatedAt: Date.now() });
/* Item 7: delete vote subcollection before the activity document.
   Firestore does not recursively delete child collections from client code. */
export async function deleteActivity(bid, activityId) {
  const votes = await getDocs(votesCol(bid, activityId));
  let batch = writeBatch(db), count = 0;
  for (const vote of votes.docs) {
    batch.delete(vote.ref);
    count++;
    if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
  }
  if (count > 0) await batch.commit();
  await deleteDoc(activityRef(bid, activityId));
}
/* SEC-05 / FUNC-02: votes stored as one document per voter UID in a subcollection.
   Document ID = authenticated UID, so each person gets exactly one vote. */
export const castVote = (bid, activityId, voterUid, optionIdx, flat) =>
  setDoc(voteRef(bid, activityId, voterUid), { optionIdx, flat, updatedAt: Date.now() });

export const subscribeActivityVotes = (bid, activityId, cb) =>
  onSnapshot(query(votesCol(bid, activityId)), (snap) =>
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))));

/* Legacy alias — remove after confirming no other callers */
export const voteOnPoll = (bid, id, flat, optionIdx) => {
  console.warn("voteOnPoll is deprecated — use castVote with UID");
  return updateDoc(activityRef(bid, id), { [`poll.votes.${flat}`]: optionIdx });
};


/* ---- Per-flat payment tracking ---- */
/* Record a payment for a flat. Updates outstanding balance on the building doc.
   payments stored as: buildings/{bid}.payments = [ { id, flat, amount, date, note, month } ] */
export async function recordPayment(bid, flat, amount, date, note, month) {
  const snap = await getDoc(bldRef(bid));
  const data = snap.exists() ? snap.data() : {};
  const payments = data.payments || [];
  const outstanding = data.outstanding || {};
  const entry = {
    id: "pay_" + Math.random().toString(36).slice(2, 8),
    flat, amount: Number(amount), date, note: note || "", month: month || "",
    createdAt: Date.now(),
  };
  // Reduce outstanding for this flat
  const prev = Number(outstanding[flat] || 0);
  const newBal = Math.max(0, prev - Number(amount));
  await updateDoc(bldRef(bid), {
    payments: [...payments, entry],
    [`outstanding.${flat}`]: newBal,
  });
}

/* Set the bill amount for a flat (adds to outstanding). Called when bills are finalized. */
export async function addToOutstanding(bid, flat, amount) {
  const snap = await getDoc(bldRef(bid));
  const data = snap.exists() ? snap.data() : {};
  const prev = Number((data.outstanding || {})[flat] || 0);
  await updateDoc(bldRef(bid), { [`outstanding.${flat}`]: prev + Number(amount) });
}

/* Bulk set outstanding for all flats (used when finalizing a period) */
export async function bulkAddOutstanding(bid, bills) {
  const snap = await getDoc(bldRef(bid));
  const data = snap.exists() ? snap.data() : {};
  const outstanding = { ...(data.outstanding || {}) };
  Object.entries(bills).forEach(([flat, amount]) => {
    outstanding[flat] = Number(outstanding[flat] || 0) + Number(amount);
  });
  await updateDoc(bldRef(bid), { outstanding });
}

/* Get payment history for a flat */
export function getPaymentsForFlat(payments, flat) {
  return (payments || []).filter((p) => p.flat === flat).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}


/* Remove a member from the building (admin only).
   Deletes the membership doc, frees their flat claim, and removes the
   building from the user's own buildings array so they don't get stuck
   on "Loading ledger…" after re-login. */
export async function removeMember(bid, uid, flat) {
  const batch = writeBatch(db);
  batch.delete(memberRef(bid, uid));
  if (flat) batch.update(flatRef(bid, flat), { claimedByUid: null });
  batch.update(userRef(uid), { buildings: arrayRemove(bid) });
  await batch.commit();
}

/* ---- EVENTS (festival donations & expenses) ----
   SEC-11: the full events/{eid} doc is resident-only. A parallel
   eventSummaries/{eid} doc holds guest-safe fields (name, year, status,
   totals, counts) and is what guests subscribe to. createEvent/updateEvent/
   deleteEvent keep both in sync in a single client batch. */
export const subscribeEvents = (bid, cb) =>
  onSnapshot(query(eventsCol(bid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error("subscribeEvents failed:", err.code, err.message); cb([]); });

export const subscribeEventSummaries = (bid, cb) =>
  onSnapshot(query(eventSummariesCol(bid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error("subscribeEventSummaries failed:", err.code, err.message); cb([]); });

function computeEventSummary(data) {
  const donations = Array.isArray(data.donations) ? data.donations : [];
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const collectedTotal = donations.reduce((s, d) => s + Number(d.amount || 0), 0);
  const spentTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const openingBalance = Number(data.openingBalance || 0);
  const closingBalance = data.closingBalance != null ? Number(data.closingBalance) : null;
  const balance = openingBalance + collectedTotal - spentTotal;
  return {
    name: String(data.name || ""),
    year: Number(data.year || new Date().getFullYear()),
    status: data.status === "closed" ? "closed" : "active",
    targetAmount: Number(data.targetAmount || 0),
    openingBalance,
    collectedTotal,
    spentTotal,
    balance,
    closingBalance,
    donorCount: donations.length,
    expenseCount: expenses.length,
    updatedAt: Date.now(),
  };
}

export async function createEvent(bid, data) {
  const ref = doc(eventsCol(bid));
  const now = Date.now();
  const full = { ...data, createdAt: now, updatedAt: now };
  const batch = writeBatch(db);
  batch.set(ref, full);
  batch.set(eventSummaryRef(bid, ref.id), { ...computeEventSummary(full), createdAt: now });
  await batch.commit();
  return ref.id;
}

export async function updateEvent(bid, id, patch) {
  // Read the current event so the derived summary reflects the merged state
  // (patch may only touch a subset of fields). If the read fails, fall back
  // to writing the event and letting the summary re-sync on the next update.
  let current = {};
  try {
    const snap = await getDoc(eventRef(bid, id));
    if (snap.exists()) current = snap.data() || {};
  } catch { /* ignore — summary refresh will happen on the next update */ }
  const merged = { ...current, ...patch };
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(eventRef(bid, id), { ...patch, updatedAt: now });
  batch.set(eventSummaryRef(bid, id), computeEventSummary(merged), { merge: true });
  await batch.commit();
}

export async function deleteEvent(bid, id) {
  const batch = writeBatch(db);
  batch.delete(eventRef(bid, id));
  batch.delete(eventSummaryRef(bid, id));
  await batch.commit();
}

/* SEC-11 one-shot maintenance: write a guest-safe eventSummaries/{eid}
   doc for every event that doesn't yet have one. Events created before
   SEC-11 do not have summaries; guests would see an empty Events list
   until they're backfilled.

   Idempotent: skips events that already have a matching summary. Only
   admin or a member with the 'treasurer' role can run this — the same
   auth as canCreateEventSummary in firestore.rules. Returns
   { total, written, skipped }. */
export async function backfillEventSummaries(bid) {
  const [eventsSnap, summariesSnap] = await Promise.all([
    getDocs(eventsCol(bid)),
    getDocs(eventSummariesCol(bid)),
  ]);
  const existing = new Set(summariesSnap.docs.map((d) => d.id));
  const missing = eventsSnap.docs.filter((d) => !existing.has(d.id));
  if (missing.length === 0) {
    return { total: eventsSnap.size, written: 0, skipped: existing.size };
  }
  // Firestore batch limit is 500 writes; chunk to stay well under it.
  const CHUNK = 400;
  let written = 0;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const batch = writeBatch(db);
    const now = Date.now();
    for (const evDoc of missing.slice(i, i + CHUNK)) {
      const summary = computeEventSummary(evDoc.data() || {});
      batch.set(eventSummaryRef(bid, evDoc.id), { ...summary, createdAt: now });
      written++;
    }
    await batch.commit();
  }
  return { total: eventsSnap.size, written, skipped: existing.size };
}

/* Admin-only: delete an entire building — every subcollection doc and the
   config document. The deleting admin's own account is cleaned up via
   currentUid; other members' stale building references are pruned on
   their next login via the self-heal effect in App.jsx (SEC-01). */
export async function deleteBuilding(bid, currentUid) {
  const cols = [flatsCol(bid), waterCol(bid), maintCol(bid), membersCol(bid), activitiesCol(bid), presetsCol(bid), eventsCol(bid), eventSummariesCol(bid)];
  // delete all subcollection docs (batched)
  for (const c of cols) {
    const snap = await getDocs(c);
    let batch = writeBatch(db), n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref); n++;
      if (n === 400) { await batch.commit(); batch = writeBatch(db); n = 0; }
    }
    if (n > 0) await batch.commit();
  }
  await deleteDoc(bldRef(bid));
  // SEC-03: also remove public discovery doc
  try { await deleteDoc(publicBldRef(bid)); } catch (e) { console.error("Could not delete public building doc:", e); }
  // Clean the admin's own account reference (self-write, allowed by rules)
  if (currentUid) {
    await updateDoc(userRef(currentUid), {
      buildings: arrayRemove(bid),
    });
  }
}
