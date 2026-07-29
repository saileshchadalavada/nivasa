import React, { useEffect, useState, useRef, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import {
  ensureAccount, subscribeAccount, subscribeBuilding, subscribeFlats, subscribeMembers,
  subscribeMembership, getBuilding,
  subscribeWaterPeriods, saveWaterPeriod, startNextWaterPeriod, deleteWaterPeriod, ensureWaterPeriod,
  subscribeMaintPeriods, saveMaintPeriod, startNextMaintPeriod, deleteMaintPeriod, ensureMaintPeriod,
  deleteBuilding, setPaidFlag, backfillWater2026,
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

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) { await ensureAccount(u.uid, (u.email || "").split("@")[0]); }
    else { setAccount(null); }
    setAuthReady(true);
  }), []);

  useEffect(() => { if (!user) return; return subscribeAccount(user.uid, setAccount); }, [user]);

  useEffect(() => {
    const bids = account?.buildings || [];
    let alive = true;
    Promise.all(bids.map((b) => getBuilding(b).catch(() => null)))
      .then((list) => { if (!alive) return; const m = {}; list.forEach((b) => b && (m[b.id] = b.name)); setBnames(m); });
    return () => { alive = false; };
  }, [account]);

  const isMemberOf = (bid) => !!(account?.buildings || []).includes(bid);
  const joinContext = user && account && urlBid && !isMemberOf(urlBid);
  const effectiveBid = useMemo(() => {
    if (!account || joinContext) return "";
    if (urlBid && isMemberOf(urlBid)) return urlBid;
    if (activeBid && isMemberOf(activeBid)) return activeBid;
    const stored = getStored();
    if (stored && isMemberOf(stored)) return stored;
    return (account.buildings || [])[0] || "";
  }, [account, activeBid, urlBid, joinContext]);

  useEffect(() => {
    if (!user || !effectiveBid) {
      setConfig(undefined); setFlats([]); setMembers([]); setMembership(undefined);
      setAllWater(null); setAllMaint(null); return;
    }
    setConfig(undefined); setMembership(undefined); setAllWater(null); setAllMaint(null);
    setWaterDirty(false); setMaintDirty(false);
    const unsubs = [
      subscribeBuilding(effectiveBid, setConfig),
      subscribeFlats(effectiveBid, setFlats),
      subscribeMembers(effectiveBid, setMembers),
      subscribeMembership(effectiveBid, user.uid, setMembership),
      subscribeWaterPeriods(effectiveBid, setAllWater),
      subscribeMaintPeriods(effectiveBid, setAllMaint),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [user, effectiveBid]);

  const sortedWater = useMemo(() => newest(allWater || []), [allWater]);
  const sortedMaint = useMemo(() => newest(allMaint || []), [allMaint]);

  // DISPLAY period (Overview + header) = the latest period WITH dates — the real
  // current bill. A blank just-started draft never becomes the displayed current.
  const latestDated = (arr) => { const d = arr.filter((p) => p.periodEnd); return d.length ? d.reduce((a, b) => ((a.periodEnd || "") >= (b.periodEnd || "") ? a : b)) : (arr[arr.length - 1] || null); };
  const displayWater = latestDated(sortedWater);
  const displayMaint = latestDated(sortedMaint);
  // EDIT default = newest created (the blank draft if one was just started)
  const newestWater = sortedWater[sortedWater.length - 1] || null;
  const newestMaint = sortedMaint[sortedMaint.length - 1] || null;
  const hasDraftWater = sortedWater.some((p) => !p.periodEnd);
  const hasDraftMaint = sortedMaint.some((p) => !p.periodEnd);
  // History = dated periods except the current display bill
  const pastWater = sortedWater.filter((p) => p.periodEnd && (!displayWater || p.id !== displayWater.id));
  const pastMaint = sortedMaint.filter((p) => p.periodEnd && (!displayMaint || p.id !== displayMaint.id));

  const [selWaterId, setSelWaterId] = useState("");
  const [selMaintId, setSelMaintId] = useState("");
  const selectedWater = sortedWater.find((p) => p.id === selWaterId) || newestWater;
  const selectedMaint = sortedMaint.find((p) => p.id === selMaintId) || newestMaint;
  // start-next only from the current bill, and only if no blank draft is pending
  const isLatestWater = !!selectedWater && !!displayWater && selectedWater.id === displayWater.id && !hasDraftWater;
  const isLatestMaint = !!selectedMaint && !!displayMaint && selectedMaint.id === displayMaint.id && !hasDraftMaint;

  useEffect(() => { if (selectedWater && !wDirty.current) setWaterMonth(selectedWater); }, [selectedWater]);
  useEffect(() => { if (selectedMaint && !mDirty.current) setMaintMonth(selectedMaint); }, [selectedMaint]);

  // current bill = which period Overview reads & marks paid on
  const currentWater = displayWater;
  const currentMaint = displayMaint;
  const togglePaidWater = (flat) => { if (displayWater) setPaidFlag(effectiveBid, "waterPeriods", displayWater.id, "paidWater", flat, !displayWater.paidWater?.[flat]); };
  const togglePaidMaint = (flat) => { if (displayMaint) setPaidFlag(effectiveBid, "maintPeriods", displayMaint.id, "paidMaint", flat, !displayMaint.paidMaint?.[flat]); };

  // self-heal: a building with no periods yet (old data, or pre-split) gets a blank starter
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

  const setMeter = (flat, meter) => { setFlatMeter(effectiveBid, flat, meter).catch(() => {}); };
  const toggleAdj = () => { updateBuilding(effectiveBid, { showAdj: !config.showAdj }).catch(() => {}); };
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
    const hasCost = (Number(currentWater.genCount) || 0) > 0 || (Number(currentWater.manCount) || 0) > 0 || (Number(currentWater.connBill) || 0) > 0;
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
    try { await deleteBuilding(effectiveBid); setStored(""); setActiveBid(""); }
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
  if (!user) return <Auth inviteBid={urlBid} />;
  if (!account) return <Splash text="Loading…" />;
  if (creating) {
    return <Setup adminUid={user.uid} username={account.username}
      existingNames={(account.buildings || []).map((b) => bnames[b]).filter(Boolean)}
      onDone={(bid) => { setCreating(false); switchTo(bid); }} onCancel={() => setCreating(false)} />;
  }
  if (joinContext) {
    return <Join bid={urlBid} code={urlCode} uid={user.uid} username={account.username}
      onJoined={(bid) => switchTo(bid)} onSignOut={() => signOut(auth)} />;
  }
  if (!effectiveBid) {
    return <Landing username={account.username} onCreate={() => setCreating(true)} onSignOut={() => signOut(auth)} />;
  }
  if (!config || membership === undefined || allWater === null || allMaint === null || !waterMonth || !maintMonth) {
    return <Splash text="Loading ledger…" />;
  }

  const admin = isAdmin(membership, config, user.uid);
  if (membership && !membership.flat && !admin) {
    return <Onboarding bid={effectiveBid} uid={user.uid} username={account.username} flats={flats} config={config} onDone={() => {}} />;
  }

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
