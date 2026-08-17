/* SEC-11: Validate a family-guest invitation and create a restricted
   guest membership.

   Contract (POST /api/join-building-guest):
     Headers:  Authorization: Bearer <Firebase ID token>
               Content-Type:  application/json
     Body:     { "bid": string,
                 "guestToken": string,
                 "targetSection": "events" | "community",
                 "eventId": string | null }
     Success:  200 { ok: true, bid, alreadyMember?: true }
     Error:    4xx/5xx { error: <CODE> }
       CODES: METHOD_NOT_ALLOWED | UNSUPPORTED_MEDIA_TYPE
              UNAUTHENTICATED | INVALID_REQUEST
              INVALID_GUEST_INVITE | GUEST_INVITE_EXPIRED
              GUEST_INVITE_REVOKED | GUEST_INVITE_EXHAUSTED
              SECTION_NOT_ALLOWED | EVENT_NOT_ALLOWED
              BUILDING_NOT_FOUND | USER_PROFILE_NOT_FOUND
              ALREADY_RESIDENT | JOIN_FAILED | INTERNAL

   Never returned or logged: raw token, tokenHash, private building doc,
   normal inviteCode, Firebase ID token, service credential.
*/

import crypto from "node:crypto";
// firebase-admin is loaded dynamically inside the handler to avoid
// ERR_REQUIRE_ESM from Vercel's Node runtime hitting a CJS→ESM boundary
// in one of firebase-admin's transitive deps at module init time.

const ALLOWED_SECTIONS = new Set(["events", "community"]);

function loadServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) throw new Error("FIREBASE_ADMIN_CREDENTIALS not set");
  const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(decoded);
}

let _adminCache = null;
async function admin() {
  if (_adminCache) return _adminCache;
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { FieldValue, getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
  _adminCache = { auth: getAuth(), db: getFirestore(), FieldValue };
  return _adminCache;
}

function fail(res, status, code) {
  return res.status(status).json({ error: code });
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("base64url");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED");

  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("application/json")) return fail(res, 415, "UNSUPPORTED_MEDIA_TYPE");

  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) return fail(res, 401, "UNAUTHENTICATED");
  const idToken = match[1].trim();
  if (!idToken || idToken.length > 4096) return fail(res, 401, "UNAUTHENTICATED");

  let bid, guestToken, targetSection, eventId;
  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    bid = typeof body.bid === "string" ? body.bid.trim() : "";
    guestToken = typeof body.guestToken === "string" ? body.guestToken : "";
    targetSection = typeof body.targetSection === "string" ? body.targetSection.trim() : "";
    eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  } catch { return fail(res, 400, "INVALID_REQUEST"); }

  if (!bid || bid.length > 64 || !/^[A-Za-z0-9_-]+$/.test(bid)) return fail(res, 400, "INVALID_REQUEST");
  if (!guestToken || guestToken.length < 16 || guestToken.length > 512) return fail(res, 400, "INVALID_REQUEST");
  if (!ALLOWED_SECTIONS.has(targetSection)) return fail(res, 400, "INVALID_REQUEST");
  if (eventId && (eventId.length > 64 || !/^[A-Za-z0-9_-]+$/.test(eventId))) return fail(res, 400, "INVALID_REQUEST");

  let uid;
  try {
    const { auth } = await admin();
    const decoded = await auth.verifyIdToken(idToken, true);
    uid = decoded.uid;
    if (!uid) return fail(res, 401, "UNAUTHENTICATED");
  } catch {
    return fail(res, 401, "UNAUTHENTICATED");
  }

  try {
    const { db, FieldValue } = await admin();
    const tokenHash = hashToken(guestToken);
    const inviteRef = db.doc(`buildings/${bid}/guestInvites/${tokenHash}`);
    const memberRef = db.doc(`buildings/${bid}/members/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    const bldRef = db.doc(`buildings/${bid}`);

    // Pre-check the building exists so we can return a specific error
    // before revealing whether an invite exists.
    const bldSnap = await bldRef.get();
    if (!bldSnap.exists) return fail(res, 404, "BUILDING_NOT_FOUND");

    // Existing owner/tenant: idempotent success WITHOUT downgrading role
    // or consuming an invite use.
    const memberPreSnap = await memberRef.get();
    if (memberPreSnap.exists) {
      const md = memberPreSnap.data();
      if (md.residentType === "owner" || md.residentType === "tenant") {
        // Ensure user's buildings array still references this bid, but
        // do not touch membership or consume the invite.
        await userRef.set({ buildings: FieldValue.arrayUnion(bid) }, { merge: true });
        return res.status(200).json({ ok: true, bid, alreadyMember: true });
      }
      if (md.residentType === "guest") {
        // Guest revisit: keep membership, do not consume invite.
        await userRef.set({ buildings: FieldValue.arrayUnion(bid) }, { merge: true });
        return res.status(200).json({ ok: true, bid, alreadyMember: true });
      }
    }

    // Load user profile for a display username. Never trust client body.
    const userSnap = await userRef.get();
    if (!userSnap.exists) return fail(res, 400, "USER_PROFILE_NOT_FOUND");
    const rawUsername = userSnap.data()?.username;
    const username = (typeof rawUsername === "string" ? rawUsername : "").trim().slice(0, 50) || "Member";

    // Validate and consume the invite in a transaction. All token-related
    // failures use a common controlled family of codes; specific reasons
    // (revoked / expired / exhausted) reveal only what the client needs
    // to render a helpful message.
    const result = await db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) return { code: "INVALID_GUEST_INVITE" };
      const invite = inviteSnap.data();

      if (invite.status === "revoked") return { code: "GUEST_INVITE_REVOKED" };
      if (invite.status !== "active") return { code: "INVALID_GUEST_INVITE" };
      if (Number(invite.expiresAt) && Date.now() > Number(invite.expiresAt)) return { code: "GUEST_INVITE_EXPIRED" };
      const used = Number(invite.usedCount || 0);
      const max = Number(invite.maxUses || 0);
      if (max > 0 && used >= max) return { code: "GUEST_INVITE_EXHAUSTED" };

      const allowed = Array.isArray(invite.allowedSections) ? invite.allowedSections : [];
      if (!allowed.includes(targetSection)) return { code: "SECTION_NOT_ALLOWED" };

      if (invite.eventId) {
        if (targetSection !== "events") return { code: "SECTION_NOT_ALLOWED" };
        if (!eventId || eventId !== invite.eventId) return { code: "EVENT_NOT_ALLOWED" };
      }

      // Re-check membership inside tx to avoid a race where the caller
      // was enrolled by another concurrent request between our pre-check
      // and here. Do NOT consume a use in that case.
      const memberInTxSnap = await tx.get(memberRef);
      if (memberInTxSnap.exists) {
        return { code: "OK_ALREADY_MEMBER" };
      }

      tx.set(memberRef, {
        username,
        flat: null,
        roles: [],
        residentType: "guest",
        phone: null,
        joinedAt: Date.now(),
      });
      tx.set(userRef, { buildings: FieldValue.arrayUnion(bid) }, { merge: true });
      tx.update(inviteRef, {
        usedCount: used + 1,
        lastUsedAt: Date.now(),
      });
      return { code: "OK_NEW_GUEST" };
    });

    switch (result.code) {
      case "OK_NEW_GUEST": return res.status(200).json({ ok: true, bid });
      case "OK_ALREADY_MEMBER":
        await userRef.set({ buildings: FieldValue.arrayUnion(bid) }, { merge: true });
        return res.status(200).json({ ok: true, bid, alreadyMember: true });
      case "INVALID_GUEST_INVITE": return fail(res, 403, "INVALID_GUEST_INVITE");
      case "GUEST_INVITE_REVOKED":  return fail(res, 403, "GUEST_INVITE_REVOKED");
      case "GUEST_INVITE_EXPIRED":  return fail(res, 403, "GUEST_INVITE_EXPIRED");
      case "GUEST_INVITE_EXHAUSTED": return fail(res, 403, "GUEST_INVITE_EXHAUSTED");
      case "SECTION_NOT_ALLOWED":   return fail(res, 403, "SECTION_NOT_ALLOWED");
      case "EVENT_NOT_ALLOWED":     return fail(res, 403, "EVENT_NOT_ALLOWED");
      default:                      return fail(res, 500, "JOIN_FAILED");
    }
  } catch (e) {
    console.error("join-building-guest error:", e?.code || e?.message || "unknown");
    return fail(res, 500, "INTERNAL");
  }
}
