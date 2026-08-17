/* SEC-10 /api/join-building unit tests.
   firebase-admin is mocked so tests are hermetic and can run in CI without
   an emulator or real credentials. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory Firestore state used by the mocks.
const state = {
  users: new Map(),      // uid -> data
  buildings: new Map(),  // bid -> data
  members: new Map(),    // `${bid}/${uid}` -> data
  batches: [],           // captured batch payloads for assertion
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
  const makeDocRef = (path) => {
    const parts = path.split("/");
    const [collection, id, sub, subId] = parts;
    const key = () => {
      if (parts.length === 2) return { store: state[collection === "users" ? "users" : "buildings"], id };
      if (parts.length === 4 && sub === "members") return { store: state.members, id: `${id}/${subId}` };
      throw new Error("unknown path: " + path);
    };
    return {
      path,
      async get() {
        const { store, id } = key();
        const data = store.get(id);
        return { exists: !!data, data: () => data };
      },
      async set(data, options = {}) {
        const { store, id } = key();
        const existing = store.get(id) || {};
        store.set(id, options.merge ? applyPatch(existing, data) : applyPatch({}, data));
      },
    };
  };
  const getFirestore = () => ({
    doc: (path) => makeDocRef(path),
    batch: () => {
      const ops = [];
      return {
        set(ref, data, options) { ops.push({ ref, data, options }); },
        async commit() {
          state.batches.push(ops.map(({ ref, data }) => ({ path: ref.path, data })));
          for (const { ref, data, options } of ops) await ref.set(data, options || {});
        },
      };
    },
  });
  return { getFirestore, FieldValue };
});

async function loadHandler() {
  vi.resetModules();
  const mod = await import("../api/join-building.js");
  return mod.default;
}

function makeReqRes({ method = "POST", contentType = "application/json", auth = "Bearer valid-token", body = {} } = {}) {
  const req = {
    method,
    headers: {
      "content-type": contentType,
      authorization: auth,
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

describe("/api/join-building", () => {
  beforeEach(() => {
    state.users.clear();
    state.buildings.clear();
    state.members.clear();
    state.batches.length = 0;
    verifyIdTokenMock = vi.fn(async (token) => {
      if (token === "valid-token") return { uid: "user-alice" };
      if (token === "token-for-bob") return { uid: "user-bob" };
      const err = new Error("bad token");
      throw err;
    });
    state.users.set("user-alice", { username: "alice", buildings: [] });
    state.users.set("user-bob", { username: "bob", buildings: [] });
    state.buildings.set("bld-1", { name: "Acme", adminUid: "adminX", inviteCode: "ABC123" });
    process.env.FIREBASE_ADMIN_CREDENTIALS = JSON.stringify({
      project_id: "test",
      client_email: "x@test.iam",
      private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-POST", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.payload.error).toBe("METHOD_NOT_ALLOWED");
  });

  it("rejects non-JSON content type", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ contentType: "text/plain" });
    await handler(req, res);
    expect(res.statusCode).toBe(415);
  });

  it("rejects missing Authorization header", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ auth: "" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.payload.error).toBe("UNAUTHENTICATED");
  });

  it("rejects invalid ID token", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ auth: "Bearer garbage", body: { bid: "bld-1", inviteCode: "ABC123" } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.payload.error).toBe("UNAUTHENTICATED");
  });

  it("rejects missing bid", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ body: { inviteCode: "ABC123" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toBe("INVALID_REQUEST");
  });

  it("returns BUILDING_NOT_FOUND for unknown building", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ body: { bid: "bld-none", inviteCode: "ABC123" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toBe("BUILDING_NOT_FOUND");
  });

  it("returns INVALID_INVITE_CODE for wrong code", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ body: { bid: "bld-1", inviteCode: "WRONG9" } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toBe("INVALID_INVITE_CODE");
  });

  it("joins successfully with correct code and creates empty roles + null flat", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ body: { bid: "bld-1", inviteCode: "abc123" /* case-insensitive */ } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ok: true, bid: "bld-1" });

    const member = state.members.get("bld-1/user-alice");
    expect(member).toBeDefined();
    expect(member.roles).toEqual([]);
    expect(member.flat).toBeNull();
    expect(member.residentType).toBe("owner");

    const userDoc = state.users.get("user-alice");
    expect(userDoc.buildings).toContain("bld-1");
  });

  it("is idempotent when the caller is already a member", async () => {
    state.members.set("bld-1/user-alice", { username: "alice", flat: null, roles: [], residentType: "owner", joinedAt: 1 });
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ body: { bid: "bld-1", inviteCode: "ABC123" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.alreadyMember).toBe(true);
    // account users doc should still list the building
    expect(state.users.get("user-alice").buildings).toContain("bld-1");
  });

  it("derives uid from the verified token — caller cannot choose another uid", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({
      auth: "Bearer valid-token", // alice's token
      body: { bid: "bld-1", inviteCode: "ABC123", uid: "user-bob" }, // trying to spoof bob
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    // alice becomes a member, bob does not
    expect(state.members.get("bld-1/user-alice")).toBeDefined();
    expect(state.members.get("bld-1/user-bob")).toBeUndefined();
  });

  it("never returns or persists the invite code", async () => {
    const handler = await loadHandler();
    const { req, res } = makeReqRes({ body: { bid: "bld-1", inviteCode: "ABC123" } });
    await handler(req, res);
    expect(JSON.stringify(res.payload)).not.toContain("ABC123");
    const member = state.members.get("bld-1/user-alice");
    expect(JSON.stringify(member)).not.toContain("ABC123");
  });
});
