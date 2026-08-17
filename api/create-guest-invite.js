/* SEC-11: Create a family-guest invitation link.

   Any resident member (owner, tenant, or admin) of the building may
   create a guest invite. Guests cannot. The endpoint validates the
   caller's role via Firebase Admin, generates a cryptographically
   random token, stores only its SHA-256 hash, and returns a shareable
   URL containing the raw token.

   Contract (POST /api/create-guest-invite):
     Headers:  Authorization: Bearer <Firebase ID token>
               Content-Type:  application/json
     Body:     { "bid": string,
                 "targetSection": "events" | "community",
                 "eventId": string | null }   // required when section == "events"
     Success:  200 { ok: true, url: string, expiresAt: number, maxUses: number }
     Error:    4xx/5xx { error: <CODE> }
       CODES: METHOD_NOT_ALLOWED | UNSUPPORTED_MEDIA_TYPE
              UNAUTHENTICATED | INVALID_REQUEST
              NOT_AUTHORIZED | BUILDING_NOT_FOUND | EVENT_NOT_FOUND
              INTERNAL

   Server-only credential: FIREBASE_ADMIN_CREDENTIALS
     (raw or base64-encoded service-account JSON; never expose to browser).

   Token design:
     - Raw token: 32 bytes from crypto.randomBytes, base64url-encoded.
     - Stored:    SHA-256 of raw token, used as the guestInvites doc ID
                  for O(1) lookup during /join-building-guest.
     - The raw token exists only in the returned URL. Firestore never
       holds the raw value.
*/

import crypto from "node:crypto";
// firebase-admin is loaded dynamically inside the handler to avoid
// ERR_REQUIRE_ESM from Vercel's Node runtime hitting a CJS→ESM boundary
// in one of firebase-admin's transitive deps at module init time.

const DEFAULT_GUEST_INVITE_VALIDITY_DAYS = 30;
const DEFAULT_GUEST_INVITE_MAX_USES = 20;

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
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
  _adminCache = { auth: getAuth(), db: getFirestore() };
  return _adminCache;
}

function fail(res, status, code) {
  return res.status(status).json({ error: code });
}

function randomToken() {
  // 32 bytes → 43-char base64url. Sufficient entropy for a share token.
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("base64url");
}

function isResidentType(t) {
  return t === "owner" || t === "tenant";
}

function baseUrlFromRequest(req) {
  const override = process.env.NIVASA_APP_URL;
  if (override) return override.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return "https://nivasa-myhomeapp.vercel.app";
  return `${proto}://${host}`;
}

function buildShareUrl(req, { bid, rawToken, targetSection, eventId }) {
  const base = baseUrlFromRequest(req);
  const params = new URLSearchParams();
  params.set("b", bid);
  params.set("guest", rawToken);
  params.set("tab", targetSection);
  if (eventId) params.set("e", eventId);
  return `${base}/?${params.toString()}`;
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

  let bid, targetSection, eventId;
  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    bid = typeof body.bid === "string" ? body.bid.trim() : "";
    targetSection = typeof body.targetSection === "string" ? body.targetSection.trim() : "";
    eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  } catch { return fail(res, 400, "INVALID_REQUEST"); }

  if (!bid || bid.length > 64 || !/^[A-Za-z0-9_-]+$/.test(bid)) return fail(res, 400, "INVALID_REQUEST");
  if (!ALLOWED_SECTIONS.has(targetSection)) return fail(res, 400, "INVALID_REQUEST");
  if (eventId && (eventId.length > 64 || !/^[A-Za-z0-9_-]+$/.test(eventId))) return fail(res, 400, "INVALID_REQUEST");
  // Events section requires a specific event scope (avoids over-broad invites).
  if (targetSection === "events" && !eventId) return fail(res, 400, "INVALID_REQUEST");

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
    const { db } = await admin();

    // Authorize: caller must be admin OR a resident (owner/tenant) member.
    // Guests cannot generate invites.
    const [bldSnap, memberSnap] = await Promise.all([
      db.doc(`buildings/${bid}`).get(),
      db.doc(`buildings/${bid}/members/${uid}`).get(),
    ]);
    if (!bldSnap.exists) return fail(res, 404, "BUILDING_NOT_FOUND");
    const bld = bldSnap.data() || {};
    const isAdmin = bld.adminUid === uid;
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const memberIsResident = !!memberData && isResidentType(memberData.residentType);
    if (!isAdmin && !memberIsResident) return fail(res, 403, "NOT_AUTHORIZED");

    if (eventId) {
      const evSnap = await db.doc(`buildings/${bid}/events/${eventId}`).get();
      if (!evSnap.exists) return fail(res, 404, "EVENT_NOT_FOUND");
    }

    // Generate raw token + hash; hash becomes the doc ID.
    const rawToken = randomToken();
    const tokenHash = hashToken(rawToken);
    const now = Date.now();
    const expiresAt = now + DEFAULT_GUEST_INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

    await db.doc(`buildings/${bid}/guestInvites/${tokenHash}`).set({
      status: "active",
      allowedSections: [targetSection],
      eventId: eventId || null,
      createdBy: uid,
      createdAt: now,
      expiresAt,
      maxUses: DEFAULT_GUEST_INVITE_MAX_USES,
      usedCount: 0,
    });

    const url = buildShareUrl(req, { bid, rawToken, targetSection, eventId });
    return res.status(200).json({
      ok: true,
      url,
      expiresAt,
      maxUses: DEFAULT_GUEST_INVITE_MAX_USES,
    });
  } catch (e) {
    console.error("create-guest-invite error:", e?.code || e?.message || "unknown");
    return fail(res, 500, "INTERNAL");
  }
}
