/* SEC-11 endpoint tests for /api/create-guest-invite and
   /api/join-building-guest. firebase-admin is mocked so the tests run
   hermetically without an emulator. */
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- In-memory Firestore state used by both endpoint mocks ----
const state = {
  users:         new Map(), // uid -> data
  buildings:     new Map(), // bid -> data
  members:       new Map(), // `${bid}/${uid}` -> data
  events:        new Map(), // `${bid}/${eid}` -> data
  guestInvites:  new Map(), // `${bid}/${tokenHash}` -> data
};

let verifyIdTokenMock;

vi.mock("firebase-admin/app", () => ({
  cert: () => ({}),
  getApps: () => [{}],
  initializeApp: () => ({}),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: (...a) => verifyIdTokenMock(...a),
  }),
}));

vi.mock("firebase-admin/firestore", () => {
  const FieldValue = { arrayUnion: (...vals) => ({ __arrayUnion: vals }) };
  const applyPatch = (existing, patch) => {
    const next = { ...existing };
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === "object" && Array.isArray(v.__arrayUnion)) {
        const cur = Array.isArray(next[k]) ? next[k] : [];
        const additions = v.__arrayUnion.filter((x) => !cur.includes(x));
        next[k] = [...cur, ...additions];
      } else {
        next[k] = v;
      }
    }
    return next;
  };
  const lookup = (path) => {
    const parts = path.split("/");
    if (parts.length === 2 && parts[0] === "users") return { store: state.users, id: parts[1] };
    if (parts.length === 2 && parts[0] === "buildings") return { store: state.buildings, id: parts[1] };
    if (parts.length === 4 && parts[0] === "buildings" && parts[2] === "members")
      return { store: state.members, id: `${parts[1]}/${parts[3]}` };
    if (parts.length === 4 && parts[0] === "buildings" && parts[2] === "events")
      return { store: state.events, id: `${parts[1]}/${parts[3]}` };
    if (parts.length === 4 && parts[0] === "buildings" && parts[2] === "guestInvites")
      return { store: state.guestInvites, id: `${parts[1]}/${parts[3]}` };
    throw new Error("unknown path: " + path);
  };
  const makeDocRef = (path) => ({
    path,
    async get() {
      const { store, id } = lookup(path);
      const data = store.get(id);
      return { exists: !!data, data: () => data };
    },
    async set(data, options = {}) {
      const { store, id } = lookup(path);
      const existing = store.get(id) || {};
      store.set(id, options.merge ? applyPatch(existing, data) : applyPatch({}, data));
    },
    async update(patch) {
      const { store, id } = lookup(path);
      const existing = store.get(id);
      if (!existing) throw new Error("no such doc: " + path);
      store.set(id, applyPatch(existing, patch));
    },
  });
  const getFirestore = () => ({
    doc: (path) => makeDocRef(path),
    batch: () => {
      const ops = [];
      return {
        set(ref, data, options) { ops.push({ op: "set", ref, data, options }); },
        update(ref, patch) { ops.push({ op: "update", ref, patch }); },
        async commit() {
          for (const op of ops) {
            if (op.op === "set") await op.ref.set(op.data, op.options || {});
            else await op.ref.update(op.patch);
          }
        },
      };
    },
    runTransaction: async (fn) => {
      // Simple sequential impl — safe for hermetic single-threaded tests.
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, data, options) => ref.set(data, options || {}),
        update: (ref, patch) => ref.update(patch),
      };
      return fn(tx);
    },
  });
  return { getFirestore, FieldValue };
});

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("base64url");
}

async function loadCreate() {
  vi.resetModules();
  const mod = await import("../api/create-guest-invite.js");
  return mod.default;
}
async function loadJoin() {
  vi.resetModules();
  const mod = await import("../api/join-building-guest.js");
  return mod.default;
}

function makeReqRes({ method = "POST", contentType = "application/json", auth = "Bearer valid-token", body = {}, headers = {} } = {}) {
  const req = {
    method,
    headers: {
      "content-type": contentType,
      authorization: auth,
      host: "nivasa-myhomeapp.vercel.app",
      "x-forwarded-proto": "https",
      ...headers,
    },
    body,
  };
  const res = {
    statusCode: 0,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
  };
  return { req, res };
}

function resetState() {
  state.users.clear();
  state.buildings.clear();
  state.members.clear();
  state.events.clear();
  state.guestInvites.clear();
}

describe("/api/create-guest-invite", () => {
  beforeEach(() => {
    resetState();
    verifyIdTokenMock = vi.fn(async (token) => {
      if (token === "admin-token")  return { uid: "adminA" };
      if (token === "owner-token")  return { uid: "ownerX" };
      if (token === "guest-token")  return { uid: "guestY" };
      throw new Error("bad token");
    });
    state.users.set("adminA", { username: "admin", buildings: ["b1"] });
    state.users.set("ownerX", { username: "owner", buildings: ["b1"] });
    state.users.set("guestY", { username: "guest", buildings: ["b1"] });
    state.buildings.set("b1", { name: "Acme", adminUid: "adminA", inviteCode: "SECRET1" });
    state.members.set("b1/adminA", { username: "admin", flat: null, roles: ["admin"], residentType: "owner", joinedAt: 1 });
    state.members.set("b1/ownerX", { username: "owner", flat: null, roles: [], residentType: "owner", joinedAt: 1 });
    state.members.set("b1/guestY", { username: "guest", flat: null, roles: [], residentType: "guest", joinedAt: 1 });
    state.events.set("b1/ev1", { name: "Test Event", year: 2026, status: "active" });
    process.env.FIREBASE_ADMIN_CREDENTIALS = JSON.stringify({
      project_id: "test", client_email: "x@t.iam", private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("rejects GET", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ method: "GET" });
    await h(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects missing Firebase token", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "" });
    await h(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.payload.error).toBe("UNAUTHENTICATED");
  });

  it("rejects invalid Firebase token", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer bogus", body: { bid: "b1", targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects missing bid", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer admin-token", body: { targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid section", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer admin-token", body: { bid: "b1", targetSection: "meters", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects events section without eventId", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer admin-token", body: { bid: "b1", targetSection: "events" } });
    await h(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects unknown event", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer admin-token", body: { bid: "b1", targetSection: "events", eventId: "ghost" } });
    await h(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toBe("EVENT_NOT_FOUND");
  });

  it("rejects a guest caller (NOT_AUTHORIZED)", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer guest-token", body: { bid: "b1", targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("NOT_AUTHORIZED");
  });

  it("succeeds for admin: returns URL with b/guest/tab/e; stores hash not raw", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer admin-token", body: { bid: "b1", targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(200);
    const url = new URL(res.payload.url);
    expect(url.searchParams.get("b")).toBe("b1");
    expect(url.searchParams.get("tab")).toBe("events");
    expect(url.searchParams.get("e")).toBe("ev1");
    const rawToken = url.searchParams.get("guest");
    expect(rawToken).toBeTruthy();
    const stored = state.guestInvites.get(`b1/${hashToken(rawToken)}`);
    expect(stored).toBeDefined();
    expect(stored.status).toBe("active");
    expect(stored.allowedSections).toEqual(["events"]);
    expect(stored.eventId).toBe("ev1");
    // Never store the raw token anywhere.
    for (const v of state.guestInvites.values()) {
      expect(JSON.stringify(v)).not.toContain(rawToken);
    }
    // Response never leaks the invite code.
    expect(JSON.stringify(res.payload)).not.toContain("SECRET1");
  });

  it("succeeds for an owner/tenant resident (spec allows any resident)", async () => {
    const h = await loadCreate();
    const { req, res } = makeReqRes({ auth: "Bearer owner-token", body: { bid: "b1", targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(200);
  });
});

describe("/api/join-building-guest", () => {
  let rawToken;
  let tokenHash;

  const seedActiveInvite = (opts = {}) => {
    rawToken = "token_" + crypto.randomBytes(16).toString("hex");
    tokenHash = hashToken(rawToken);
    state.guestInvites.set(`b1/${tokenHash}`, {
      status: "active",
      allowedSections: ["events"],
      eventId: "ev1",
      createdBy: "adminA",
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      maxUses: 5,
      usedCount: 0,
      ...opts,
    });
  };

  beforeEach(() => {
    resetState();
    verifyIdTokenMock = vi.fn(async (token) => {
      if (token === "alice-token")  return { uid: "alice" };
      if (token === "bob-token")    return { uid: "bob" };
      if (token === "owner-token")  return { uid: "ownerZ" };
      throw new Error("bad token");
    });
    state.users.set("alice", { username: "alice", buildings: [] });
    state.users.set("bob", { username: "bob", buildings: [] });
    state.users.set("ownerZ", { username: "ownerZ", buildings: ["b1"] });
    state.buildings.set("b1", { name: "Acme", adminUid: "adminA", inviteCode: "SECRET1" });
    state.members.set("b1/ownerZ", { username: "ownerZ", flat: "101", roles: [], residentType: "owner", joinedAt: 1 });
    process.env.FIREBASE_ADMIN_CREDENTIALS = JSON.stringify({
      project_id: "test", client_email: "x@t.iam", private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    });
    seedActiveInvite();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("rejects missing Firebase token", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "" });
    await h(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid guest token (unknown)", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: "totally-not-real-token-value", targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("INVALID_GUEST_INVITE");
  });

  it("rejects an expired invite", async () => {
    seedActiveInvite({ expiresAt: Date.now() - 1000 });
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("GUEST_INVITE_EXPIRED");
  });

  it("rejects a revoked invite", async () => {
    seedActiveInvite({ status: "revoked" });
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("GUEST_INVITE_REVOKED");
  });

  it("rejects an exhausted invite", async () => {
    seedActiveInvite({ maxUses: 3, usedCount: 3 });
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("GUEST_INVITE_EXHAUSTED");
  });

  it("rejects wrong section", async () => {
    seedActiveInvite({ allowedSections: ["community"], eventId: null });
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("SECTION_NOT_ALLOWED");
  });

  it("rejects wrong event ID for an event-scoped invite", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "different-event" } });
    await h(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("EVENT_NOT_ALLOWED");
  });

  it("valid new guest: creates membership with flat:null, roles:[], residentType:guest; increments usedCount", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(200);
    const m = state.members.get("b1/alice");
    expect(m).toBeDefined();
    expect(m.flat).toBeNull();
    expect(m.roles).toEqual([]);
    expect(m.residentType).toBe("guest");
    expect(state.users.get("alice").buildings).toContain("b1");
    expect(state.guestInvites.get(`b1/${tokenHash}`).usedCount).toBe(1);
  });

  it("caller cannot spoof uid from body", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1", uid: "bob" } });
    await h(req, res);
    expect(res.statusCode).toBe(200);
    expect(state.members.get("b1/alice")).toBeDefined();
    expect(state.members.get("b1/bob")).toBeUndefined();
  });

  it("caller cannot request admin role", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1", roles: ["admin"] } });
    await h(req, res);
    expect(res.statusCode).toBe(200);
    expect(state.members.get("b1/alice").roles).toEqual([]);
  });

  it("caller cannot assign a flat", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1", flat: "101" } });
    await h(req, res);
    expect(res.statusCode).toBe(200);
    expect(state.members.get("b1/alice").flat).toBeNull();
  });

  it("repeat request is idempotent and does not consume an extra use", async () => {
    const h = await loadJoin();
    const body = { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" };
    const first = makeReqRes({ auth: "Bearer alice-token", body });
    await h(first.req, first.res);
    expect(first.res.statusCode).toBe(200);
    const usedAfterFirst = state.guestInvites.get(`b1/${tokenHash}`).usedCount;

    const second = makeReqRes({ auth: "Bearer alice-token", body });
    await h(second.req, second.res);
    expect(second.res.statusCode).toBe(200);
    expect(second.res.payload.alreadyMember).toBe(true);
    expect(state.guestInvites.get(`b1/${tokenHash}`).usedCount).toBe(usedAfterFirst);
  });

  it("existing owner/tenant is NOT downgraded to guest", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer owner-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.alreadyMember).toBe(true);
    const m = state.members.get("b1/ownerZ");
    expect(m.residentType).toBe("owner");
    expect(m.flat).toBe("101"); // preserved
  });

  it("raw guest token never appears in the created membership", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    const m = state.members.get("b1/alice");
    expect(JSON.stringify(m)).not.toContain(rawToken);
  });

  it("private inviteCode is never returned by the endpoint", async () => {
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(JSON.stringify(res.payload)).not.toContain("SECRET1");
  });

  it("returns USER_PROFILE_NOT_FOUND when there is no users/{uid} doc", async () => {
    state.users.delete("alice");
    const h = await loadJoin();
    const { req, res } = makeReqRes({ auth: "Bearer alice-token", body: { bid: "b1", guestToken: rawToken, targetSection: "events", eventId: "ev1" } });
    await h(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toBe("USER_PROFILE_NOT_FOUND");
  });
});
