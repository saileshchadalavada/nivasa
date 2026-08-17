/* SEC-10: Trusted invite-join endpoint.
   Browser clients cannot create memberships directly under the tightened
   firestore.rules — this endpoint is the only path for invited joins.

   Contract (POST /api/join-building):
     Headers:  Authorization: Bearer <Firebase ID token>
               Content-Type:  application/json
     Body:     { "bid": string, "inviteCode": string }
     Success:  200 { ok: true, bid }
     Error:    4xx/5xx { error: <CODE> }
       CODES: METHOD_NOT_ALLOWED | INVALID_CONTENT_TYPE
              UNAUTHENTICATED | INVALID_REQUEST
              BUILDING_NOT_FOUND | INVALID_INVITE_CODE
              ALREADY_MEMBER | INTERNAL

   Server-only credential: FIREBASE_ADMIN_CREDENTIALS
     Value is the service-account JSON, either raw or base64-encoded.
     NEVER expose to the browser (no VITE_ prefix).

   Module system: CommonJS (see api/package.json).
*/

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

function loadServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) throw new Error("FIREBASE_ADMIN_CREDENTIALS not set");
  const decoded = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(decoded);
}

let _adminCache = null;
function admin() {
  if (_adminCache) return _adminCache;
  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
  _adminCache = { auth: getAuth(), db: getFirestore() };
  return _adminCache;
}

function fail(res, status, code) {
  return res.status(status).json({ error: code });
}

function normalizeCode(s) {
  return String(s || "").trim().toUpperCase();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED");

  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("application/json")) return fail(res, 415, "INVALID_CONTENT_TYPE");

  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) return fail(res, 401, "UNAUTHENTICATED");
  const idToken = match[1].trim();
  if (!idToken || idToken.length > 4096) return fail(res, 401, "UNAUTHENTICATED");

  let bid, inviteCode;
  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    bid = typeof body.bid === "string" ? body.bid.trim() : "";
    inviteCode = typeof body.inviteCode === "string" ? body.inviteCode : "";
  } catch { return fail(res, 400, "INVALID_REQUEST"); }

  if (!bid || bid.length > 64 || !/^[A-Za-z0-9_-]+$/.test(bid)) return fail(res, 400, "INVALID_REQUEST");
  const normalizedCode = normalizeCode(inviteCode);
  if (!normalizedCode || normalizedCode.length < 4 || normalizedCode.length > 32) {
    return fail(res, 400, "INVALID_REQUEST");
  }

  let uid;
  try {
    const { auth } = admin();
    const decoded = await auth.verifyIdToken(idToken, true);
    uid = decoded.uid;
    if (!uid) {
      console.error("join-building: verified token had no uid");
      return fail(res, 401, "UNAUTHENTICATED");
    }
  } catch (e) {
    const msg = String(e?.message || "");
    const code = String(e?.code || "");
    let hint = "verify_failed";
    if (msg.includes("FIREBASE_ADMIN_CREDENTIALS not set")) hint = "creds_missing";
    else if (msg.includes("Unexpected token") || msg.includes("JSON")) hint = "creds_malformed_json";
    else if (code === "auth/id-token-expired") hint = "token_expired";
    else if (code === "auth/argument-error") hint = "token_malformed";
    else if (code === "auth/id-token-revoked") hint = "token_revoked";
    else if (code === "auth/invalid-credential" || msg.includes("Failed to determine project ID") || msg.includes("project ID")) hint = "creds_or_project_id_mismatch";
    console.error(`join-building: 401 hint=${hint} code=${code}`);
    return fail(res, 401, "UNAUTHENTICATED");
  }

  try {
    const { db } = admin();
    const bldRef = db.doc(`buildings/${bid}`);
    const bldSnap = await bldRef.get();
    if (!bldSnap.exists) return fail(res, 404, "BUILDING_NOT_FOUND");
    const bld = bldSnap.data() || {};
    const stored = normalizeCode(bld.inviteCode);
    if (!stored || stored !== normalizedCode) return fail(res, 403, "INVALID_INVITE_CODE");

    const memberRef = db.doc(`buildings/${bid}/members/${uid}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) {
      const userRef = db.doc(`users/${uid}`);
      await userRef.set(
        { buildings: FieldValue.arrayUnion(bid) },
        { merge: true }
      );
      return res.status(200).json({ ok: true, bid, alreadyMember: true });
    }

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const rawUsername = userSnap.exists ? userSnap.data()?.username : "";
    const username = (typeof rawUsername === "string" ? rawUsername : "").trim().slice(0, 50) || "Member";

    const batch = db.batch();
    batch.set(memberRef, {
      username,
      flat: null,
      roles: [],
      residentType: "owner",
      phone: null,
      joinedAt: Date.now(),
    });
    batch.set(userRef, { buildings: FieldValue.arrayUnion(bid) }, { merge: true });
    await batch.commit();

    return res.status(200).json({ ok: true, bid });
  } catch (e) {
    console.error("join-building error:", e?.code || e?.message || "unknown");
    return fail(res, 500, "INTERNAL");
  }
};
