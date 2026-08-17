import React, { useEffect, useState, useRef, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import {
  ensureAccount, subscribeAccount, subscribeBuilding, subscribeFlats, subscribeMembers,
  subscribeMembership, getBuilding, getPublicBuilding,
  subscribeWaterPeriods, saveWaterPeriod, startNextWaterPeriod, deleteWaterPeriod, ensureWaterPeriod,
  subscribeMaintPeriods, saveMaintPeriod, startNextMaintPeriod, deleteMaintPeriod, ensureMaintPeriod,
  subscribeActivities,
  subscribeEvents, subscribeEventSummaries,
  joinBuildingAsGuestByInvite,
  deleteBuilding, backfillWater2026,
  removeOwnBuildingReference,
} from "./data";
import { isAdmin } from "./seedData";
import { labelFromStart } from "./util";
import { setFlatMeter, addWaterPeriod, addMaintPeriod, updateBuilding } from "./data";
import Auth from "./Auth";
import Landing from "./Landing";
import Join from "./Join";
import Setup from "./Setup";
import Onboarding from "./Onboarding";
import Dashboard from "./Dashboard";
import { GuestEnrollment, IncompleteEventLink } from "./GuestEnrollment";
import { T, css, font } from "./styles";

const LS = "nivasa_active_bid";
const getStored = () => { try { return localStorage.getItem(LS) || ""; } catch { return ""; } };
const setStored = (v) => { try { localStorage.setItem(LS, v); } catch {} };
const clearUrl = () => { try { window.history.replaceState({}, "", window.location.pathname); } catch {} };
const newest = (arr) => arr.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

// SEC-11: family-guest flow. A shared Events/Community link carries a
// short-lived guest token that survives account creation via sessionStorage.
// The token authorizes the trusted /api/join-building-guest endpoint to
// create a restricted guest membership. No browser code decides whether the
// token is valid — that stays server-side.
const GUEST_SS_KEY = "nivasa_guest_ctx";
const GUEST_TOKEN_ERRORS = new Set([
  "INVALID_GUEST_INVITE", "GUEST_INVITE_EXPIRED", "GUEST_INVITE_REVOKED",
  "GUEST_INVITE_EXHAUSTED", "SECTION_NOT_ALLOWED", "EVENT_NOT_ALLOWED",
  "BUILDING_NOT_FOUND", "USER_PROFILE_NOT_FOUND",
]);
const isSupportedSection = (t) => t === "events" || t === "community";
function getGuestCtx() {
  try {
    const raw = sessionStorage.getItem(GUEST_SS_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw);
    if (!ctx || typeof ctx !== "object") return null;
    if (typeof ctx.bid !== "string" || !ctx.bid) return null;
    if (typeof ctx.guestToken !== "string" || ctx.guestToken.length < 16) return null;
    if (!isSupportedSection(ctx.targetSection)) return null;
    return ctx;
  } catch { return null; }
}
function setGuestCtx(ctx) {
  try {
    if (ctx) sessionStorage.setItem(GUEST_SS_KEY, JSON.stringify(ctx));
    else sessionStorage.removeItem(GUEST_SS_KEY);
  } catch {}
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(undefined);
  const [activeBid, setActiveBid] = useState("");
  const [creating, setCreating] = useState(false);

  const [config, setConfig] = useState(undefined);
  const [flats, setFlats] = useState([]);
  const [members, setMembers] = useState([]);
  const [membership, setMembership] = useState(undefined);
  const [allWater, setAllWater] = useState(null);
  const [allMaint, setAllMaint] = useState(null);
  const [bnames, setBnames] = useState({});
  const [activities, setActivities] = useState(null);
  const [events, setEvents] = useState(null);

  const [waterMonth, setWaterMonth] = useState(null);
  const [maintMonth, setMaintMonth] = useState(null);
  const [waterDirty, setWaterDirty] = useState(false);
  const [maintDirty, setMaintDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const wDirty = useRef(false); wDirty.current = waterDirty;
  const mDirty = useRef(false); mDirty.current = maintDirty;

  const params = new URLSearchParams(window.location.search);
  const urlBid = params.get("b") || "";
  const urlCode = params.get("join") || params.get("code") || "";
  const urlGuestToken = params.get("guest") || "";
  const urlTab = params.get("tab") || "";
  const urlEventId = params.get("e") || "";

  // Persist a fresh guest URL to sessionStorage SYNCHRONOUSLY so it survives
  // Firebase auth-state redirects that clear the query string.
  if (urlBid && urlGuestToken && isSupportedSection(urlTab)) {
    const existing = getGuestCtx();
    // Prefer the URL if it differs from any stale ctx we might still hold.
    if (!existing || existing.bid !== urlBid || existing.guestToken !== urlGuestToken || existing.eventId !== (urlEventId || null)) {
      setGuestCtx({ bid: urlBid, guestToken: urlGuestToken, targetSection: urlTab, eventId: urlEventId || null, at: Date.now() });
    }
  }
  const ssGuest = getGuestCtx();

  // Flow classification. Evaluate the guest flow first so a plain
  // ?b=X&tab=events&e=Y is never mistaken for a resident invite.
  const isGuestFlow = !!ssGuest;
  const isNormalInviteFlow = !!(urlBid && urlCode);
  const isIncompleteEventLink =
    !!urlBid && urlTab === "events" && !!urlEventId && !urlGuestToken && !urlCode && !isGuestFlow;

  const [guestState, setGuestState] = useState("idle"); // "idle" | "preparing" | "enrolling" | "opening" | "error"
  const [guestError, setGuestError] = useState(null);
  const [guestPublicName, setGuestPublicName] = useState("");
  const guestEnrollStarted = useRef(false);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) { await ensureAccount(u.uid, (u.email || "").split("@")[0]); }
    else { setAccount(null); }
    setAuthReady(true);
  }), []);

  useEffect(() => { if (!user) return; return subscribeAccount(user.uid, setAccount); }, [user]);

  // Building-name lookup for the switcher menu. account.buildings is populated
  // only after the user is a confirmed member, so getBuilding() is authorized
  // by the isResidentMember-gated rule (residents/admin) OR — for existing
  // guest members — falls back to publicBuildings for the display name only.
  useEffect(() => {
    const bids = account?.buildings || [];
    let alive = true;
    Promise.all(bids.map(async (b) => {
      const full = await getBuilding(b).catch(() => null);
      if (full) return { id: b, name: full.name };
      const pub = await getPublicBuilding(b).catch(() => null);
      return pub ? { id: b, name: pub.name } : null;
    })).then((list) => {
      if (!alive) return;
      const m = {};
      list.forEach((b) => b && (m[b.id] = b.name));
      setBnames(m);
    });
    return () => { alive = false; };
  }, [account]);

  // Pre-load the public building name for the guest enrollment / incomplete
  // link screens (both run BEFORE membership so buildings/{bid} is unreadable).
  useEffect(() => {
    const bid = (isGuestFlow && ssGuest?.bid) || (isIncompleteEventLink && urlBid) || "";
    if (!bid) { setGuestPublicName(""); return; }
    let alive = true;
    getPublicBuilding(bid).then((b) => { if (alive && b) setGuestPublicName(b.name || ""); }).catch(() => {});
    return () => { alive = false; };
  }, [isGuestFlow, ssGuest?.bid, isIncompleteEventLink, urlBid]);

  const isMemberOf = (bid) => !!(account?.buildings || []).includes(bid);
  // SEC-11: only route to Join.jsx when we have a normal resident invite.
  // Guest URLs go through the GuestEnrollment path instead.
  const joinContext = user && account && urlBid && !isMemberOf(urlBid) && isNormalInviteFlow;

  // Guest enrollment: after the user is authenticated, POST the token to
  // /api/join-building-guest. Do not touch Firestore membership from here.
  useEffect(() => {
    if (!isGuestFlow || !user || !account || !ssGuest) return;
    if (isMemberOf(ssGuest.bid)) {
      // Already a member (owner/tenant/guest). Skip enrollment; the URL
      // cleanup effect below will hand off to Dashboard with tab/e preserved.
      guestEnrollStarted.current = false;
      return;
    }
    if (guestEnrollStarted.current) return;
    guestEnrollStarted.current = true;
    setGuestError(null);
    setGuestState("enrolling");
    joinBuildingAsGuestByInvite({
      bid: ssGuest.bid,
      guestToken: ssGuest.guestToken,
      targetSection: ssGuest.targetSection,
      eventId: ssGuest.eventId,
    }).then(() => {
      // Wait for subscribeAccount to reflect the new bid, then the URL
      // cleanup effect hands off to Dashboard.
      setGuestState("opening");
    }).catch((e) => {
      const code = e?.code || "INTERNAL";
      setGuestError(code);
      setGuestState("error");
      guestEnrollStarted.current = false;
      // Unrecoverable token errors: clear the ctx so retry doesn't loop.
      if (GUEST_TOKEN_ERRORS.has(code)) setGuestCtx(null);
    });
  }, [isGuestFlow, user?.uid, account?.buildings?.length, ssGuest?.bid]); // eslint-disable-line

  // Once membership + account reflect the guest bid, clear the guest ctx and
  // rewrite the URL to just b/tab/e so refreshes still land on the shared
  // event (without leaking the guest token).
  useEffect(() => {
    if (!ssGuest || !account || !membership) return;
    if (!(account.buildings || []).includes(ssGuest.bid)) return;
    const p = new URLSearchParams();
    p.set("b", ssGuest.bid);
    p.set("tab", ssGuest.targetSection);
    if (ssGuest.eventId) p.set("e", ssGuest.eventId);
    try { window.history.replaceState({}, "", `${window.location.pathname}?${p.toString()}`); } catch {}
    setGuestCtx(null);
    guestEnrollStarted.current = false;
  }, [account, membership, ssGuest?.bid]); // eslint-disable-line
  const effectiveBid = useMemo(() => {
    if (!account || joinContext) return "";
    if (urlBid && isMemberOf(urlBid)) return urlBid;
    if (activeBid && isMemberOf(activeBid)) return activeBid;
    const stored = getStored();
    if (stored && isMemberOf(stored)) return stored;
    return (account.buildings || [])[0] || "";
  }, [account, activeBid, urlBid, joinContext]);

  // SEC-11: universally-allowed subscriptions (membership + activities).
  // These read paths work for both guest and resident members, so they
  // start immediately when a building is selected — before we know the
  // residentType.
  useEffect(() => {
    if (!user || !effectiveBid) {
      setConfig(undefined); setFlats([]); setMembers([]); setMembership(undefined);
      setAllWater(null); setAllMaint(null); setActivities(null); setEvents(null); return;
    }
    setConfig(undefined); setMembership(undefined); setAllWater(null); setAllMaint(null);
    setActivities(null); setEvents(null); setFlats([]); setMembers([]);
    setWaterDirty(false); setMaintDirty(false);
    const unsubs = [
      subscribeMembership(effectiveBid, user.uid, setMembership),
      subscribeActivities(effectiveBid, setActivities),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [user, effectiveBid]); // eslint-disable-line

  // SEC-11: resident-only vs guest-only feeds branch after membership
  // resolves. Guests read a minimal config from publicBuildings and
  // eventSummaries for the Events tab; they get [] for water/maint/flats/
  // members/full events. Residents get the full subscription set.
  useEffect(() => {
    if (!effectiveBid || membership === undefined) return;
    if (membership === null) {
      setAllWater([]); setAllMaint([]); setEvents([]); setConfig(null);
      return;
    }
    const isGuestMember = membership?.residentType === "guest";
    if (isGuestMember) {
      setAllWater([]); setAllMaint([]); setFlats([]); setMembers([]);
      let alive = true;
      getPublicBuilding(effectiveBid)
        .then((b) => { if (alive) setConfig(b || { id: effectiveBid, name: "Building" }); })
        .catch(() => { if (alive) setConfig({ id: effectiveBid, name: "Building" }); });
      const unsubSummaries = subscribeEventSummaries(effectiveBid, setEvents);
      return () => { alive = false; if (unsubSummaries) unsubSummaries(); };
    }
    const unsubs = [
      subscribeBuilding(effectiveBid, setConfig),
      subscribeFlats(effectiveBid, setFlats),
      subscribeMembers(effectiveBid, setMembers),
      subscribeWaterPeriods(effectiveBid, setAllWater),
      subscribeMaintPeriods(effectiveBid, setAllMaint),
      subscribeEvents(effectiveBid, setEvents),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [effectiveBid, membership?.residentType]); // eslint-disable-line

  /* SEC-01 self-heal: when the user's membership is gone (admin removed them)
     or the building itself was deleted, clean the stale building ID from their
     own account and redirect to the next available building or Landing.
     Debounce 3 s: a brief null during subscription startup should not trigger
     cleanup — only act when genuinely inaccessible after settling. */
  useEffect(() => {
    if (!user || !effectiveBid) return;
    const inaccessible = membership === null || config === null;
    if (!inaccessible) return;

    const timer = setTimeout(() => {
      removeOwnBuildingReference(user.uid, effectiveBid)
        .then(() => {
          if (getStored() === effectiveBid) {
            setStored("");
          }
          setActiveBid("");
        })
        .catch((error) => {
          console.error("Could not clean building reference", error);
        });
    }, 3000);
    return () => clearTimeout(timer);
  }, [user, effectiveBid, membership, config]); // eslint-disable-line

const sortedWater = useMemo(() => newest(allWater || []), [allWater]);
  const sortedMaint = useMemo(() => newest(allMaint || []), [allMaint]);

  const latestDated = (arr) => { const d = arr.filter((p) => p.periodEnd); return d.length ? d.reduce((a, b) => ((a.periodEnd || "") >= (b.periodEnd || "") ? a : b)) : (arr[arr.length - 1] || null); };
  const displayWater = latestDated(sortedWater);
  const displayMaint = latestDated(sortedMaint);
  const newestWater = sortedWater[sortedWater.length - 1] || null;
  const newestMaint = sortedMaint[sortedMaint.length - 1] || null;
  const hasDraftWater = sortedWater.some((p) => !p.periodEnd);
  const hasDraftMaint = sortedMaint.some((p) => !p.periodEnd);
  const pastWater = sortedWater.filter((p) => p.periodEnd && (!displayWater || p.id !== displayWater.id));
  const pastMaint = sortedMaint.filter((p) => p.periodEnd && (!displayMaint || p.id !== displayMaint.id));

  const [selWaterId, setSelWaterId] = useState("");
  const [selMaintId, setSelMaintId] = useState("");
  const selectedWater = sortedWater.find((p) => p.id === selWaterId) || newestWater;
  const selectedMaint = sortedMaint.find((p) => p.id === selMaintId) || newestMaint;
  const isLatestWater = !!selectedWater && !!displayWater && selectedWater.id === displayWater.id && !hasDraftWater;
  const isLatestMaint = !!selectedMaint && !!displayMaint && selectedMaint.id === displayMaint.id && !hasDraftMaint;

  useEffect(() => { if (selectedWater && !wDirty.current) setWaterMonth(selectedWater); }, [selectedWater]);
  useEffect(() => { if (selectedMaint && !mDirty.current) setMaintMonth(selectedMaint); }, [selectedMaint]);

  const currentWater = displayWater;
  const currentMaint = displayMaint;

  const seeded = useRef({});
  useEffect(() => {
    if (!effectiveBid || allWater === null) return;
    if (allWater.length === 0 && flats.length > 0 && !seeded.current[effectiveBid + "w"]) {
      seeded.current[effectiveBid + "w"] = true;
      ensureWaterPeriod(effectiveBid, flats).catch(() => { seeded.current[effectiveBid + "w"] = false; });
    }
  }, [effectiveBid, allWater, flats]);
  useEffect(() => {
    if (!effectiveBid || allMaint === null) return;
    if (allMaint.length === 0 && !seeded.current[effectiveBid + "m"]) {
      seeded.current[effectiveBid + "m"] = true;
      ensureMaintPeriod(effectiveBid).catch(() => { seeded.current[effectiveBid + "m"] = false; });
    }
  }, [effectiveBid, allMaint]);

  const patchWater = (u) => { setWaterMonth((m) => (typeof u === "function" ? u(m) : { ...m, ...u })); setWaterDirty(true); };
  const patchMaint = (u) => { setMaintMonth((m) => (typeof u === "function" ? u(m) : { ...m, ...u })); setMaintDirty(true); };

  const overlap = (list, self) => {
    const s = self.periodStart, e = self.periodEnd;
    if (!s || !e) return null;
    return list.find((p) => p.id !== self.id && p.periodStart && p.periodEnd && s <= p.periodEnd && e >= p.periodStart) || null;
  };
  const save = async () => {
    if (waterDirty && (!waterMonth.periodStart || !waterMonth.periodEnd)) { alert("Set the water period From/To dates before saving."); return; }
    if (maintDirty && (!maintMonth.periodStart || !maintMonth.periodEnd)) { alert("Set the maintenance period From/To dates before saving."); return; }
    // FUNC-08: block save when any meter has current < previous (likely data entry error)
    if (waterDirty) {
      const badFlats = Object.entries(waterMonth.readings || {})
        .filter(([, r]) => r.curr !== "" && r.curr != null && Number(r.curr) < Number(r.prev || 0))
        .map(([flat]) => flat);
      if (badFlats.length > 0) {
        alert(`Current reading is less than previous for flat(s): ${badFlats.join(", ")}.\n\nPlease correct the readings. If the meter was replaced, contact admin to adjust manually.`);
        return;
      }
    }
    if (waterDirty) { const o = overlap(sortedWater, waterMonth); if (o && !window.confirm(`These water dates overlap the ${labelFromStart(o.periodStart) || "another"} period (${o.periodStart} → ${o.periodEnd}). Save anyway?`)) return; }
    if (maintDirty) { const o = overlap(sortedMaint, maintMonth); if (o && !window.confirm(`These maintenance dates overlap the ${labelFromStart(o.periodStart) || "another"} period (${o.periodStart} → ${o.periodEnd}). Save anyway?`)) return; }
    setSaving(true);
    try {
      if (waterDirty) { await saveWaterPeriod(effectiveBid, waterMonth.id, waterMonth); setWaterDirty(false); }
      if (maintDirty) { await saveMaintPeriod(effectiveBid, maintMonth.id, maintMonth); setMaintDirty(false); }
    } catch (e) { alert("Couldn't save: " + (e?.code || e?.message || "unknown error")); }
    finally { setSaving(false); }
  };
  const discard = () => { setWaterMonth(selectedWater); setMaintMonth(selectedMaint); setWaterDirty(false); setMaintDirty(false); };

  const selectWater = (id) => { if (waterDirty) { alert("Save or undo your water changes before switching periods."); return; } setSelWaterId(id); };
  const selectMaint = (id) => { if (maintDirty) { alert("Save or undo your maintenance changes before switching periods."); return; } setSelMaintId(id); };

  const setMeter = (flat, meter) => { setFlatMeter(effectiveBid, flat, meter).catch((e) => console.error("Meter update failed:", e)); };
  const toggleAdj = () => { updateBuilding(effectiveBid, { showAdj: !config.showAdj }).catch((e) => console.error("Toggle adjustment failed:", e)); };
  const backfillWater = async () => {
    if (waterDirty) { alert("Save or undo your changes first."); return; }
    setSaving(true);
    try { const id = await addWaterPeriod(effectiveBid, flats); setSelWaterId(id);
      alert("Blank water period added. Set its dates (a past month goes to History) and readings, then Save."); }
    catch (e) { alert("Couldn't add period: " + (e?.code || e?.message)); }
    finally { setSaving(false); }
  };
  const backfillMaint = async () => {
    if (maintDirty) { alert("Save or undo your changes first."); return; }
    setSaving(true);
    try { const id = await addMaintPeriod(effectiveBid); setSelMaintId(id);
      alert("Blank maintenance period added. Set its dates (a past month goes to History) and expenses, then Save."); }
    catch (e) { alert("Couldn't add period: " + (e?.code || e?.message)); }
    finally { setSaving(false); }
  };

  const startWater = async () => {
    if (waterDirty) { alert("Save your water changes before starting the next water period."); return; }
    if (!currentWater.periodStart || !currentWater.periodEnd) { alert("Fill in and save this water period's dates first."); return; }
    const hasCostItems = (currentWater.costItems || []).some((ci) => (Number(ci.quantity) || 0) > 0 && (Number(ci.rate) || 0) > 0);
    const hasCost = hasCostItems || (Number(currentWater.genCount) || 0) > 0 || (Number(currentWater.manCount) || 0) > 0 || (Number(currentWater.connBill) || 0) > 0;
    const hasReads = Object.values(currentWater.readings || {}).some((r) => r.curr !== "" && r.curr != null && Number(r.curr) > (Number(r.prev) || 0));
    if (!hasCost || !hasReads) { alert("Enter this period's tanker costs and meter readings before starting the next one."); return; }
    setSaving(true);
    try { const id = await startNextWaterPeriod(effectiveBid, currentWater); setWaterDirty(false); setSelWaterId(id);
      alert("New water period started (blank). Fill in dates, tankers and current readings. The previous water period is now in History."); }
    catch (e) { alert("Couldn't start water period: " + (e?.code || e?.message)); }
    finally { setSaving(false); }
  };
  const startMaint = async () => {
    if (maintDirty) { alert("Save your maintenance changes before starting the next maintenance period."); return; }
    if (!currentMaint.periodStart || !currentMaint.periodEnd) { alert("Fill in and save this maintenance period's dates first."); return; }
    if (!(currentMaint.expenses || []).some((e) => Number(e.amount) > 0)) { alert("Add at least one expense before starting the next maintenance period."); return; }
    setSaving(true);
    try { const id = await startNextMaintPeriod(effectiveBid, currentMaint); setMaintDirty(false); setSelMaintId(id);
      alert("New maintenance period started for the next calendar month. The previous one is now in History."); }
    catch (e) { alert("Couldn't start maintenance period: " + (e?.code || e?.message)); }
    finally { setSaving(false); }
  };
  const deleteWater = async () => {
    if (sortedWater.length <= 1) { alert("Can't delete the only water period."); return; }
    setSaving(true);
    try { await deleteWaterPeriod(effectiveBid, selectedWater.id); setWaterDirty(false); setSelWaterId(""); }
    catch (e) { alert("Couldn't delete water period: " + (e?.code || e?.message)); }
    finally { setSaving(false); }
  };
  const deleteMaint = async () => {
    if (sortedMaint.length <= 1) { alert("Can't delete the only maintenance period."); return; }
    setSaving(true);
    try { await deleteMaintPeriod(effectiveBid, selectedMaint.id); setMaintDirty(false); setSelMaintId(""); }
    catch (e) { alert("Couldn't delete maintenance period: " + (e?.code || e?.message)); }
    finally { setSaving(false); }
  };

  const switchTo = (bid) => { setStored(bid); setActiveBid(bid); clearUrl(); setWaterDirty(false); setMaintDirty(false); };

  const removeBuilding = async () => {
    const name = config?.name || "this building";
    if (!window.confirm(`Delete "${name}" and ALL its data — flats, members, and water & maintenance history?\n\nThis cannot be undone.`)) return;
    setSaving(true);
    try { await deleteBuilding(effectiveBid, user.uid); setStored(""); setActiveBid(""); }
    catch (e) { alert("Couldn't delete building: " + (e?.code || e?.message || "unknown error")); }
    finally { setSaving(false); }
  };
  const importWater2026 = async () => {
    if (!window.confirm("Import the 2026 water months (Jan, Feb, Apr, May) as real, editable periods? You'll be able to select and correct them in the Water tab's period picker.")) return;
    setSaving(true);
    try {
      const starts = sortedWater.map((p) => p.periodStart).filter(Boolean);
      const n = await backfillWater2026(effectiveBid, starts);
      alert(n ? `Imported ${n} past water period(s). Open the Water tab → "Editing period" to select and edit them.` : "Already imported — nothing new to add.");
    } catch (e) { alert("Import failed: " + (e?.code || e?.message || "unknown error")); }
    finally { setSaving(false); }
  };

  if (!authReady) return <Splash text="Loading…" />;
  if (!user) {
    return <Auth
      buildingId={urlBid}
      normalInviteFlow={isNormalInviteFlow}
      guestFlow={isGuestFlow}
      guestBuildingName={guestPublicName}
    />;
  }
  if (!account) return <Splash text="Loading…" />;
  // SEC-11: guest enrollment routes BEFORE Join.jsx so a guest URL is
  // never mistaken for a resident invite.
  if (isGuestFlow && ssGuest && !isMemberOf(ssGuest.bid)) {
    if (guestState === "error") {
      return <GuestEnrollment
        buildingName={guestPublicName}
        state="error"
        errorCode={guestError}
        onRetry={() => {
          setGuestError(null);
          setGuestState("preparing");
          guestEnrollStarted.current = false;
        }}
        onSignOut={() => signOut(auth)}
      />;
    }
    return <GuestEnrollment
      buildingName={guestPublicName}
      state={guestState === "idle" ? "preparing" : guestState}
    />;
  }
  if (creating) {
    return <Setup adminUid={user.uid} username={account.username}
      existingNames={(account.buildings || []).map((b) => bnames[b]).filter(Boolean)}
      onDone={(bid) => { setCreating(false); switchTo(bid); }} onCancel={() => setCreating(false)} />;
  }
  // SEC-11: legacy Events links without a guest token get the explicit
  // "ask for a new link" screen instead of the misleading invite-code prompt.
  if (isIncompleteEventLink && !isMemberOf(urlBid)) {
    return <IncompleteEventLink buildingName={guestPublicName} onSignOut={() => signOut(auth)} />;
  }
  if (joinContext) {
    return <Join bid={urlBid} code={urlCode}
      onJoined={(bid) => switchTo(bid)} onSignOut={() => signOut(auth)} />;
  }
  if (!effectiveBid) {
    return <Landing username={account.username} onCreate={() => setCreating(true)} onSignOut={() => signOut(auth)} />;
  }
  if (membership === null) {
    return <Landing username={account.username} onCreate={() => setCreating(true)} onSignOut={() => signOut(auth)} />;
  }
  // Show onboarding as soon as config + membership are ready — no need to wait for water/maint.
  // Editor roles (water, treasurer) also bypass onboarding so they can reach the Dashboard
  // even if they haven't claimed a flat yet.
  // Guests (family members) skip onboarding — they have no flat to claim.
  const hasEditorRole = membership?.roles?.some((r) => ["admin", "water", "treasurer"].includes(r));
  const isGuest = membership?.residentType === "guest";
  const skipOnboarding = config && membership ? (isAdmin(membership, config, user.uid) || hasEditorRole || isGuest) : false;
  if (config && membership && !membership.flat && !skipOnboarding) {
    if (!flats.length) return <Splash text="Loading flats…" />;
    return <Onboarding bid={effectiveBid} uid={user.uid} username={account.username} flats={flats} config={config}
      onSignOut={() => signOut(auth)}
      onDone={() => {
        // membership is subscribed reactively — Firestore will push the flat update
        // and App will re-render into Dashboard automatically. No extra state needed.
      }} />;
  }

  if (!config || membership === undefined || activities === null || events === null ||
      (!isGuest && (allWater === null || allMaint === null || !waterMonth || !maintMonth))) {
    return <Splash text="Loading ledger…" />;
  }

  const admin = isAdmin(membership, config, user.uid);

  const buildingList = (account.buildings || []).map((b) => ({ bid: b, name: bnames[b] || "Building" }));

  return (
    <Dashboard
      user={user} membership={membership} config={config} bid={effectiveBid}
      flats={flats} members={members}
      waterMonth={waterMonth} maintMonth={maintMonth} pastWater={pastWater} pastMaint={pastMaint}
      displayWater={displayWater} displayMaint={displayMaint}
      waterList={sortedWater} maintList={sortedMaint}
      selWaterId={selectedWater ? selectedWater.id : ""} selMaintId={selectedMaint ? selectedMaint.id : ""}
      onSelectWater={selectWater} onSelectMaint={selectMaint} isLatestWater={isLatestWater} isLatestMaint={isLatestMaint}
      onSetMeter={setMeter} onBackfillWater={backfillWater} onBackfillMaint={backfillMaint}
      showAdj={!!config.showAdj} onToggleAdj={toggleAdj}
      patchWater={patchWater} patchMaint={patchMaint}
      buildings={buildingList} onSwitch={switchTo} onNewBuilding={() => setCreating(true)}
      waterDirty={waterDirty} maintDirty={maintDirty} saving={saving} onSave={save} onDiscard={discard}
      onStartWater={startWater} onStartMaint={startMaint}
      onDeleteWater={deleteWater} onDeleteMaint={deleteMaint}
      canDeleteWater={sortedWater.length > 1} canDeleteMaint={sortedMaint.length > 1}
      onDeleteBuilding={removeBuilding}
      onImportWater2026={importWater2026}
      canImportWater2026={!!config.seededSrGold && !config.water2026Imported}
      onSignOut={() => signOut(auth)}
      activities={activities}
      events={events}
    />
  );
}

function Splash({ text }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bg, color: T.inkSoft, fontFamily: font, fontSize: 15, padding: 20, textAlign: "center" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {text}
    </div>
  );
}

