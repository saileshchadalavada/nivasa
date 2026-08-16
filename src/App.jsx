import React, { useEffect, useState, useRef, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import {
  ensureAccount, subscribeAccount, subscribeBuilding, subscribeFlats, subscribeMembers,
  subscribeMembership, getBuilding,
  subscribeWaterPeriods, saveWaterPeriod, startNextWaterPeriod, deleteWaterPeriod, ensureWaterPeriod,
  subscribeMaintPeriods, saveMaintPeriod, startNextMaintPeriod, deleteMaintPeriod, ensureMaintPeriod,
  subscribeActivities,
  subscribeEvents,
  joinBuildingAsGuest,
  deleteBuilding, setPaidFlag, backfillWater2026,
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
import { T, css, font } from "./styles";

const LS = "nivasa_active_bid";
const getStored = () => { try { return localStorage.getItem(LS) || ""; } catch { return ""; } };
const setStored = (v) => { try { localStorage.setItem(LS, v); } catch {} };
const clearUrl = () => { try { window.history.replaceState({}, "", window.location.pathname); } catch {} };
const newest = (arr) => arr.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

// Guest flow sessionStorage: persists the guest bid across auth redirects that clear URL params
const GUEST_SS_KEY = "nivasa_guest_bid";
const getGuestSS = () => { try { return sessionStorage.getItem(GUEST_SS_KEY) || ""; } catch { return ""; } };
const setGuestSS = (v) => { try { if (v) sessionStorage.setItem(GUEST_SS_KEY, v); else sessionStorage.removeItem(GUEST_SS_KEY); } catch {} };

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(undefined);
  const [activeBid, setActiveBid] = useState("");
  const [creating, setCreating] = useState(false);
  const [guestJoinError, setGuestJoinError] = useState(null);
  const [guestJoinRetry, setGuestJoinRetry] = useState(0);

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
  const urlTab = params.get("tab") || "";
  // Guest flow: community/events deep link without an invite code
  const isGuestFlow = !!(urlBid && (urlTab === "community" || urlTab === "events") && !urlCode);
  const guestJoinStarted = useRef(false);

  // Persist guest bid to sessionStorage SYNCHRONOUSLY so it's available on the very first render,
  // before any effects run. setGuestSS is idempotent and doesn't trigger React state changes.
  if (isGuestFlow && urlBid) setGuestSS(urlBid);
  const ssGuestBid = getGuestSS();
  // isGuestFlowActive stays true even after URL is cleared (e.g. OAuth redirect) as long as
  // sessionStorage still holds the bid.
  const isGuestFlowActive = isGuestFlow || !!ssGuestBid;
  const effectiveGuestBid = urlBid || ssGuestBid;

  console.log("[nivasa] isGuestFlow:", isGuestFlow, "isGuestFlowActive:", isGuestFlowActive, "urlBid:", urlBid, "urlTab:", urlTab, "ssGuestBid:", ssGuestBid);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) { await ensureAccount(u.uid, (u.email || "").split("@")[0]); }
    else { setAccount(null); }
    setAuthReady(true);
  }), []);

  useEffect(() => { if (!user) return; return subscribeAccount(user.uid, setAccount); }, [user]);

  // Auto-join as guest when arriving via community/events deep link
  useEffect(() => {
    console.log("[nivasa] Guest join effect — user:", !!user, "account:", !!account, "isMemberOf:", isMemberOf(effectiveGuestBid), "started:", guestJoinStarted.current, "isGuestFlowActive:", isGuestFlowActive);
    if (!isGuestFlowActive || !user || !account || isMemberOf(effectiveGuestBid)) return;
    if (guestJoinStarted.current) return;
    guestJoinStarted.current = true;
    setGuestJoinError(null);
    joinBuildingAsGuest(effectiveGuestBid, user.uid, account.username)
      .then(() => { console.log("[nivasa] Guest join result: success"); })
      .catch((e) => { console.log("[nivasa] Guest join FAILED:", e); guestJoinStarted.current = false; setGuestJoinError(e?.message || e?.code || "Could not join. Please try again."); });
  }, [isGuestFlowActive, user?.uid, account?.username, effectiveGuestBid, guestJoinRetry]); // eslint-disable-line

  // Clear sessionStorage once the user has confirmed guest membership (prevents stale loops).
  useEffect(() => {
    const bid = getGuestSS();
    if (bid && account && (account.buildings || []).includes(bid) && membership) {
      setGuestSS("");
      console.log("[nivasa] Guest flow complete — cleared sessionStorage for", bid);
    }
  }, [account, membership]); // eslint-disable-line

  useEffect(() => {
    const bids = account?.buildings || [];
    let alive = true;
    Promise.all(bids.map((b) => getBuilding(b).catch(() => null)))
      .then((list) => { if (!alive) return; const m = {}; list.forEach((b) => b && (m[b.id] = b.name)); setBnames(m); });
    return () => { alive = false; };
  }, [account]);

  const isMemberOf = (bid) => !!(account?.buildings || []).includes(bid);
  // For guest flow, skip Join.jsx — auto-join happens via the effect above
  const joinContext = user && account && urlBid && !isMemberOf(urlBid) && !isGuestFlow;
  const effectiveBid = useMemo(() => {
    if (!account || joinContext) return "";
    if (urlBid && isMemberOf(urlBid)) return urlBid;
    if (activeBid && isMemberOf(activeBid)) return activeBid;
    const stored = getStored();
    if (stored && isMemberOf(stored)) return stored;
    return (account.buildings || [])[0] || "";
  }, [account, activeBid, urlBid, joinContext]);

  // Subscribe to core building data (always, regardless of membership type)
  useEffect(() => {
    if (!user || !effectiveBid) {
      setConfig(undefined); setFlats([]); setMembers([]); setMembership(undefined);
      setAllWater(null); setAllMaint(null); setActivities(null); setEvents(null); return;
    }
    setConfig(undefined); setMembership(undefined); setAllWater(null); setAllMaint(null);
    setActivities(null); setEvents(null);
    setWaterDirty(false); setMaintDirty(false);
    const unsubs = [
      subscribeBuilding(effectiveBid, setConfig),
      subscribeFlats(effectiveBid, setFlats),
      subscribeMembers(effectiveBid, setMembers),
      subscribeMembership(effectiveBid, user.uid, setMembership),
      subscribeActivities(effectiveBid, setActivities),
      subscribeEvents(effectiveBid, setEvents),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [user, effectiveBid]);

  // Subscribe to water/maint ONLY after membership resolves as non-guest.
  // Guests never have access to billing data — subscribing would cause permission
  // errors that leave allWater/allMaint null and block the loading guard forever.
  useEffect(() => {
    if (!effectiveBid || membership === undefined) return;
    if (membership === null || membership?.residentType === "guest") {
      setAllWater([]);
      setAllMaint([]);
      return;
    }
    const unsubs = [
      subscribeWaterPeriods(effectiveBid, setAllWater),
      subscribeMaintPeriods(effectiveBid, setAllMaint),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [effectiveBid, membership?.residentType]); // eslint-disable-line

  /* SEC-01 self-heal: when the user's membership is gone (admin removed them)
     or the building itself was deleted, clean the stale building ID from their
     own account and redirect to the next available building or Landing.
     Guards:
     - Skip entirely during an active guest join flow (race: Firestore write not
       yet visible to the subscription when the effect first fires).
     - Debounce 3 s: a brief null during subscription startup should not trigger
       cleanup — only act when genuinely inaccessible after settling. */
  useEffect(() => {
    if (!user || !effectiveBid) return;
    console.log("[nivasa] SEC-01 check — membership:", membership, "config:", !!config, "isGuestFlow:", isGuestFlow, "isGuestFlowActive:", isGuestFlowActive, "guestStarted:", guestJoinStarted.current);
    if (isGuestFlowActive || guestJoinStarted.current) return;
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
  const togglePaidWater = (flat) => { if (displayWater) setPaidFlag(effectiveBid, "waterPeriods", displayWater.id, "paidWater", flat, !displayWater.paidWater?.[flat]); };
  const togglePaidMaint = (flat) => { if (displayMaint) setPaidFlag(effectiveBid, "maintPeriods", displayMaint.id, "paidMaint", flat, !displayMaint.paidMaint?.[flat]); };

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
  if (!user) return <Auth inviteBid={urlBid} guestFlow={isGuestFlow} />;
  if (!account) return <Splash text="Loading…" />;
  if (creating) {
    return <Setup adminUid={user.uid} username={account.username}
      existingNames={(account.buildings || []).map((b) => bnames[b]).filter(Boolean)}
      onDone={(bid) => { setCreating(false); switchTo(bid); }} onCancel={() => setCreating(false)} />;
  }
  // Guest flow: show splash while auto-join is in progress (before account.buildings updates).
  // Also covers the sessionStorage-fallback case where URL was cleared by an auth redirect.
  if (isGuestFlowActive && effectiveGuestBid && !isMemberOf(effectiveGuestBid)) {
    if (guestJoinError) {
      return (
        <GuestJoinError error={guestJoinError} onRetry={() => {
          setGuestJoinError(null);
          guestJoinStarted.current = false;
          setGuestJoinRetry((n) => n + 1); // increment causes the join effect to re-fire
        }} onSignOut={() => signOut(auth)} />
      );
    }
    return <Splash text="Joining as family member…" />;
  }
  if (joinContext) {
    return <Join bid={urlBid} code={urlCode} uid={user.uid} username={account.username}
      onJoined={(bid) => switchTo(bid)} onSignOut={() => signOut(auth)} />;
  }
  if (!effectiveBid) {
    return <Landing username={account.username} onCreate={() => setCreating(true)} onSignOut={() => signOut(auth)} />;
  }
  // If membership resolved to null (not a member of this building), go to Landing.
  // Guard: skip during guest flow — membership can transiently be null before the Firestore
  // subscription delivers the first server snapshot (Firestore local cache may miss the new doc).
  console.log("[nivasa] Account buildings:", account?.buildings, "membership:", membership, "effectiveBid:", effectiveBid, "isGuestFlowActive:", isGuestFlowActive);
  if (membership === null && !isGuestFlowActive && !guestJoinStarted.current) {
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
      togglePaidWater={togglePaidWater} togglePaidMaint={togglePaidMaint}
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

function GuestJoinError({ error, onRetry, onSignOut }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bg, fontFamily: font, padding: 20 }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={{ maxWidth: 360, width: "100%", background: "#fff", borderRadius: 16, padding: "28px 24px",
        border: `1px solid ${T.line}`, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontWeight: 600, fontSize: 15, color: T.ink, margin: "0 0 8px" }}>Couldn't join as family member</p>
        <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 20px", lineHeight: 1.5 }}>{error}</p>
        <button className="primaryBtn" onClick={onRetry}
          style={{ width: "100%", padding: "11px", marginBottom: 10 }}>
          Try again
        </button>
        <button onClick={onSignOut}
          style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 13, cursor: "pointer", fontFamily: font }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
