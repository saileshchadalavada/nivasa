import React, { useState, useMemo } from "react";
import { money, money2, labelFromStart, fmtDate, daysBetween } from "./util";
import { computeWater as computeWaterEngine } from "./billing/waterEngine";
import { computeMaint as computeMaintEngine } from "./billing/maintenanceEngine";
import { buildWaterSnapshot, buildMaintSnapshot } from "./snapshot";
import { generateWaterPoster, generateMaintPoster, sharePoster, canvasToBlob } from "./poster";
import { HISTORY, HISTORY_MONTHS } from "./historicalWater";
import { publishPeriod, updateBuilding, recordPayment } from "./data";
import { isAdmin, canEditWater, canEditMaint } from "./seedData";
import Members from "./Members";
import History from "./History";
import CsvUpload from "./CsvUpload";
import Broadcast from "./Broadcast";
import Community from "./Community";
import { styles as S, T, css, display, mono, font, applyTheme } from "./styles";
import { THEME_LIST, getThemeId, setThemeId } from "./theme";
import { useT, LANGUAGES } from "./i18n";
import Dangle, { DANGLES, getSavedDangle, saveDangle } from "./Dangle";

/* Responsive hook — cards on mobile, table on desktop */
function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = React.useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  React.useEffect(() => {
    const check = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return mobile;
}


export default function Dashboard({
  user, membership, config, bid, flats, members, activities,
  waterMonth, maintMonth, pastWater, pastMaint, patchWater, patchMaint,
  displayWater, displayMaint, togglePaidWater, togglePaidMaint,
  waterList, maintList, selWaterId, selMaintId, onSelectWater, onSelectMaint, isLatestWater, isLatestMaint,
  onSetMeter, onBackfillWater, onBackfillMaint, showAdj, onToggleAdj,
  buildings, onSwitch, onNewBuilding,
  waterDirty, maintDirty, saving, onSave, onDiscard,
  onStartWater, onStartMaint, onDeleteWater, onDeleteMaint, canDeleteWater, canDeleteMaint, onDeleteBuilding, onImportWater2026, canImportWater2026, onSignOut,
}) {
  const uid = user.uid;
  const mobile = useIsMobile();
  const admin = isAdmin(membership, config, uid);
  const t = useT(config);
  const canWater = canEditWater(membership, config, uid);
  const canMaint = canEditMaint(membership, config, uid);
  const meFlat = membership.flat;
  const dirty = waterDirty || maintDirty;

  const residential = useMemo(
    () => flats.filter((f) => !f.isCommon).sort((a, b) => a.flat.localeCompare(b.flat)), [flats]);
  const allMeters = useMemo(() => [...residential, ...flats.filter((f) => f.isCommon)], [flats, residential]);
  const nRes = residential.length || 1;

  const [tab, setTab] = useState(() => {
    try { const p = new URLSearchParams(window.location.search).get("tab"); return p || "home"; } catch { return "home"; }
  });
  const [openFlat, setOpenFlat] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dangleType, setDangleType] = useState(() => getSavedDangle());
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, confirmLabel, confirmColor, onConfirm }
  const [publish, setPublish] = useState(null);
  const [themeId, _setTheme] = useState(getThemeId());
  const switchTheme = (id) => { setThemeId(id); applyTheme(id); _setTheme(id); document.body.style.background = T.bg; }; // "water" | "maint" | null

  const myName = (meFlat && residential.find((f) => f.flat === meFlat)?.name) || membership.username || "Member";

  // BUILD-05: use canonical billing engines instead of local formulas
  const computeWater = (M) => computeWaterEngine(M, allMeters);
  const computeMaint = (M) => computeMaintEngine(M, nRes, Number(config?.corpus?.monthly || 0));

  // edited period (Water/Maintenance tabs)
  const water = useMemo(() => computeWater(waterMonth), [waterMonth, allMeters, nRes]);
  const maint = useMemo(() => computeMaint(maintMonth), [maintMonth, nRes]);
  // current bill (Overview + header)
  const dispWater = useMemo(() => computeWater(displayWater), [displayWater, allMeters, nRes]);
  const dispMaint = useMemo(() => computeMaint(displayMaint), [displayMaint, nRes]);

  const waterStart = waterMonth.periodStart || "", waterEnd = waterMonth.periodEnd || "";
  const maintStart = maintMonth.periodStart || "", maintEnd = maintMonth.periodEnd || "";
  const startReadyWater = !!waterStart && !!waterEnd && !waterDirty && water.grandTotal > 0 && water.rawCons > 0 && water.costItems.length > 0;
  const startReadyMaint = !!maintStart && !!maintEnd && !maintDirty && maint.total > 0;

  // current-bill date ranges for the header + Overview
  const dw = { start: displayWater?.periodStart || "", end: displayWater?.periodEnd || "", label: labelFromStart(displayWater?.periodStart) || "—" };
  const dm = { start: displayMaint?.periodStart || "", end: displayMaint?.periodEnd || "", label: labelFromStart(displayMaint?.periodStart) || "—" };

  // header period: Water/Maintenance tabs show the edited period; other tabs show the current bill
  const isMaintTab = tab === "maintenance";
  const isWaterTab = tab === "water";

  const setWaterField = (k, v) => patchWater((m) => ({ ...m, [k]: v }));
  const setReading = (flat, key, val) =>
    patchWater((m) => ({ ...m, readings: { ...m.readings, [flat]: { ...m.readings[flat], [key]: (val === "" ? "" : parseFloat(val) || 0) } } }));
  const setMaintField = (k, v) => patchMaint((m) => ({ ...m, [k]: v }));
  const setExpenses = (fn) => patchMaint((m) => ({ ...m, expenses: fn(m.expenses || []) }));

  const prevWaterCons = useMemo(() => {
    // FUNC-01: select the period whose periodEnd is strictly before the current periodStart
    const curStart = waterMonth.periodStart || "";
    // try real closed periods first — filtered to those ending before the selected period
    const prev = [...pastWater]
      .filter((p) => p.periodEnd && (!curStart || p.periodEnd < curStart))
      .sort((a, b) => (a.periodEnd || "").localeCompare(b.periodEnd || ""))
      .pop();
    if (prev) {
      const map = {};
      Object.entries(prev.readings || {}).forEach(([flat, r]) => { map[flat] = Math.max(0, (r.curr || 0) - (r.prev || 0)); });
      return map;
    }
    // fallback: baked-in history (if available) — find the month just before the current period
    const curKey = curStart.slice(0, 7);
    const prevKey = (HISTORY_MONTHS || []).filter((k) => k < curKey).pop();
    if (prevKey && HISTORY && HISTORY[prevKey]) {
      const map = {};
      Object.entries(HISTORY[prevKey]).forEach(([flat, v]) => { map[flat] = v.l || 0; });
      return map;
    }
    return {};
  }, [pastWater, waterMonth]);

  const doPublish = async (kind) => {
    const coll = kind === "water" ? "waterPeriods" : "maintPeriods";
    const id = kind === "water" ? waterMonth.id : maintMonth.id;
    try { await publishPeriod(bid, coll, id, uid); } catch (e) { console.error("Publish failed:", e); }
  };
  const snapshotText = (kind) => kind === "water"
    ? buildWaterSnapshot({ name: config.name, label: labelFromStart(waterStart) || "Water", start: fmtDate(waterStart), end: fmtDate(waterEnd), startIso: waterStart, endIso: waterEnd, rows: water.rows, prevCons: prevWaterCons, grandTotal: water.grandTotal, costItems: water.costItems })
    : buildMaintSnapshot({ name: config.name, label: labelFromStart(maintStart) || "Maintenance", start: fmtDate(maintStart), end: fmtDate(maintEnd), startIso: maintStart, endIso: maintEnd, expenses: maintMonth.expenses || [], total: maint.total, perFlat: maint.perFlat, nRes, byMember: maint.byMember });

  const snapshotPoster = (kind) => kind === "water"
    ? generateWaterPoster({ name: config.name, label: labelFromStart(waterStart) || "Water", start: fmtDate(waterStart), end: fmtDate(waterEnd), startIso: waterStart, endIso: waterEnd, rows: water.rows, prevCons: prevWaterCons, grandTotal: water.grandTotal, costItems: water.costItems })
    : generateMaintPoster({ name: config.name, label: labelFromStart(maintStart) || "Maintenance", start: fmtDate(maintStart), end: fmtDate(maintEnd), startIso: maintStart, endIso: maintEnd, expenses: maintMonth.expenses || [], total: maint.total, perFlat: maint.perFlat, byMember: maint.byMember });

  const shareInvite = async () => {
    const link = `${window.location.origin}${window.location.pathname}?b=${bid}&join=${config.inviteCode}`;
    const text = `Join our ${config.name} ledger on Nivasa: ${link} (invite code ${config.inviteCode})`;
    try { await navigator.clipboard.writeText(link); } catch {}
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const tabs = [
    ["home", "🏠"], ["dashboard", t("overview")], ["water", t("water")], ["maintenance", t("maintenance")],
    ...(meFlat ? [["flat", t("myFlat")]] : []), ["history", t("history")],
    ["community", t("community")],
    ...(admin ? [["members", t("members")]] : []),
  ];

  return (
    <div style={S.app}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ===== MOBILE HEADER ===== */}
      {mobile ? (
        <>
        <header style={MB.header}>
          <button onClick={() => setMenuOpen(true)} style={MB.hamburger}>☰</button>
          <div style={MB.headerCenter}>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: ".05em", textTransform: "uppercase" }}>Nivasa</div>
            <select value={bid} style={MB.buildingSelect} onChange={(e) => onSwitch(e.target.value)}>
              {(buildings || []).map((b) => <option key={b.bid} value={b.bid} style={{ color: "#333", background: "#fff" }}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => setTab("home")} style={{ ...S.avatar, width: 34, height: 34, fontSize: 13, cursor: "pointer" }}>{initialsOf(myName)}</div>
          </div>
        </header>
        <div style={{ position: "relative" }}>
          <Dangle type={dangleType} />
        </div>
        </>
      ) : (
        <>
        <header style={S.header}>
          <div style={S.headLeft}>
            <div onClick={() => setTab("home")} style={{ ...S.mark, background: T.brandDark, cursor: "pointer" }} title="Home">
              {[5,4,3,2,1].map((fl) => (<div key={fl} style={S.markRow}>{[0,1,2].map((c) => <span key={c} style={S.markDot} />)}</div>))}
            </div>
            <div>
              <div style={S.brandRow}>
                <select value={bid} style={S.switcher} onChange={(e) => onSwitch(e.target.value)}>
                  {(buildings || []).map((b) => <option key={b.bid} value={b.bid} style={{ color: T.ink, background: "#fff" }}>{b.name}</option>)}
                </select>
                <button style={S.newBldBtn} onClick={onNewBuilding} title="Create or join another building">＋</button>
              </div>
              <div style={S.brandSub}>{[config.city, config.state].filter(Boolean).join(", ") || "Shared ledger"} · {nRes} flats</div>
            </div>
          </div>
          <div style={S.headRight}>
            {isWaterTab ? (
              <div style={S.monthBox}>
                <div style={S.monthPill}>Water · {labelFromStart(waterStart) || "New period"}</div>
                <div style={S.monthRange}>{fmtDate(waterStart)} → {fmtDate(waterEnd)}</div>
              </div>
            ) : isMaintTab ? (
              <div style={S.monthBox}>
                <div style={S.monthPill}>Maintenance · {labelFromStart(maintStart) || "New period"}</div>
                <div style={S.monthRange}>{fmtDate(maintStart)} → {fmtDate(maintEnd)}</div>
              </div>
            ) : (
              <div style={S.monthBox}>
                <div style={S.monthPill}>Water {dw.label} · Maint {dm.label}</div>
                <div style={S.monthRange}>W {fmtDate(dw.start)}→{fmtDate(dw.end)} · M {fmtDate(dm.start)}→{fmtDate(dm.end)}</div>
              </div>
            )}
            <div style={S.userBox}>
              <div style={S.avatar}>{initialsOf(myName)}</div>
              <div style={S.userMeta}>
                <div style={S.userName}>{myName}</div>
                <div style={S.userSub}>{roleText(membership, admin, meFlat)}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {THEME_LIST.map((t) => (
                    <button key={t.id} onClick={() => switchTheme(t.id)} title={t.name}
                      style={{ width: 22, height: 22, borderRadius: "50%", border: themeId === t.id ? "2px solid #fff" : "2px solid transparent",
                        background: t.color, cursor: "pointer", fontSize: 10, padding: 0 }} />
                  ))}
                </div>
                <select value={config?.language || "en"} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.85)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                  onChange={(e) => { updateBuilding(bid, { language: e.target.value }); }}>
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code} style={{ color: "#333", background: "#fff" }}>{l.native}</option>)}
                </select>
                <button style={S.signout} onClick={onSignOut}>{t("signOut")}</button>
              </div>
            </div>
          </div>
        </header>
        <nav style={S.tabs}>
          {tabs.map(([k, l]) => (<button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>{l}</button>))}
        </nav>
        </>
      )}

      {/* ===== MOBILE HAMBURGER DRAWER ===== */}
      {mobile && menuOpen && (
        <div style={MB.drawerBack} onClick={() => setMenuOpen(false)}>
          <div style={MB.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={MB.drawerHeader}>
              <div style={MB.drawerName}>{config?.name || "Nivasa"}</div>
              <div style={MB.drawerSub}>{myName} · Flat {meFlat || "—"}</div>
              <button style={MB.drawerClose} onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div style={MB.drawerNav}>
              {tabs.filter(([k]) => k !== "home").map(([k, l]) => (
                <button key={k} onClick={() => { setTab(k); setMenuOpen(false); }}
                  style={{ ...MB.drawerItem, ...(tab === k ? MB.drawerItemActive : {}) }}>
                  {k === "dashboard" ? "📋" : k === "water" ? "💧" : k === "maintenance" ? "🔧" : k === "flat" ? "🏠" : k === "history" ? "📜" : k === "community" ? "📊" : k === "members" ? "👥" : ""} {l}
                </button>
              ))}
            </div>
            <div style={MB.drawerDivider} />
            <div style={MB.drawerSection}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>Settings</div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: T.inkSoft, display: "block", marginBottom: 6 }}>Dangle charm:</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DANGLES.map((d) => (
                    <button key={d.id} onClick={() => { setDangleType(d.id); saveDangle(d.id); }}
                      style={{ padding: "6px 10px", border: dangleType === d.id ? "2px solid " + T.water : "1.5px solid " + T.line,
                        borderRadius: 8, fontSize: 13, cursor: "pointer",
                        background: dangleType === d.id ? T.waterSoft : "#fff", fontFamily: font }}>
                      {d.emoji} {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {THEME_LIST.map((th) => (
                  <button key={th.id} onClick={() => switchTheme(th.id)}
                    style={{ width: 32, height: 32, borderRadius: "50%", border: themeId === th.id ? "2.5px solid " + T.ink : "2px solid " + T.line,
                      background: th.color, cursor: "pointer", fontSize: 12, padding: 0 }} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: T.inkSoft }}>Language:</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {LANGUAGES.map((l) => (
                    <button key={l.code} onClick={() => { updateBuilding(bid, { language: l.code }); }}
                      style={{ padding: "6px 14px", border: `1.5px solid ${(config?.language || "en") === l.code ? T.water : T.line}`,
                        borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                        background: (config?.language || "en") === l.code ? T.waterSoft : "#fff",
                        color: (config?.language || "en") === l.code ? T.water : T.inkSoft, fontFamily: font }}>
                      {l.native}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => { onNewBuilding(); setMenuOpen(false); }}
                style={{ ...MB.drawerItem, color: T.water, fontWeight: 600 }}>＋ Add building</button>
            </div>
            <div style={MB.drawerDivider} />
            <button onClick={onSignOut} style={{ ...MB.drawerItem, color: T.owed }}>{t("signOut")}</button>
          </div>
        </div>
      )}

      <main style={{ ...S.main, ...(mobile ? { padding: "16px 14px", paddingBottom: dirty ? 90 : 110 } : {}) }}>
        {tab === "home" && (
          <HomeHub
            myName={myName} meFlat={meFlat} admin={admin} mobile={mobile} t={t}
            waterLabel={dw.label} maintLabel={dm.label}
            myWaterBill={dispWater.rows.find((r) => r.flat === meFlat)?.bill || 0}
            maintPerFlat={dispMaint.perFlat}
            activityCount={(activities || []).filter((a) => Date.now() - (a.createdAt || 0) < 7 * 86400000).length}
            onNav={setTab}
          />
        )}
        {tab === "dashboard" && (
          <Overview water={dispWater} maint={dispMaint} paidWater={displayWater?.paidWater || {}} paidMaint={displayMaint?.paidMaint || {}}
            waterPeriod={dw} maintPeriod={dm}
            residential={residential} canWater={canWater} canMaint={canMaint} admin={admin} config={config}
            togglePaidWater={togglePaidWater} togglePaidMaint={togglePaidMaint} openFlat={setOpenFlat} onShare={shareInvite} mobile={mobile}
            onBroadcast={() => setShowBroadcast(true)} bid={bid} />
        )}
        {showBroadcast && (
          <Broadcast residential={residential} members={members} water={dispWater} maint={dispMaint}
            waterPeriod={dw} maintPeriod={dm} config={config}
            onClose={() => setShowBroadcast(false)} />
        )}
        {tab === "water" && (
          <WaterEntry water={water} setField={setWaterField} setReading={setReading} canEdit={canWater}
            periodStart={waterStart} periodEnd={waterEnd}
            costItems={waterMonth.costItems || []}
            onSetCostItems={(items) => patchWater((m) => ({ ...m, costItems: items }))}
            onSetMeter={onSetMeter} onBackfill={onBackfillWater} showAdj={showAdj} onToggleAdj={onToggleAdj}
            periods={waterList} selId={selWaterId} onSelect={onSelectWater} isLatest={isLatestWater}
            onPublish={() => setPublish("water")} publishedAt={displayWater?.publishedAt}
            onStartNext={onStartWater} onDeletePeriod={onDeleteWater} canDelete={canDeleteWater}
            startReady={startReadyWater} saving={saving} flats={flats} mobile={mobile} />
        )}
        {tab === "maintenance" && (
          <Maintenance maint={maint} expenses={maintMonth.expenses || []} setExpenses={setExpenses}
            residential={residential} canEdit={canMaint} setField={setMaintField}
            periodStart={maintStart} periodEnd={maintEnd} onBackfill={onBackfillMaint}
            periods={maintList} selId={selMaintId} onSelect={onSelectMaint} isLatest={isLatestMaint}
            onPublish={() => setPublish("maint")} publishedAt={displayMaint?.publishedAt}
            onStartNext={onStartMaint} onDeletePeriod={onDeleteMaint} canDelete={canDeleteMaint}
            startReady={startReadyMaint} saving={saving} mobile={mobile} config={config} bid={bid} />
        )}
        {tab === "flat" && <FlatStatement flat={meFlat} water={water} maint={maint} residential={residential} config={config} />}
        {tab === "history" && <History flat={meFlat} residential={residential} allFlats={allMeters} pastWater={pastWater} pastMaint={pastMaint} canPickAny={admin || canWater || canMaint} showSeedHistory={!!config.seededSrGold} corpusMonthly={Number(config?.corpus?.monthly || 0)} />}
        {tab === "community" && <Community bid={bid} activities={activities} membership={membership} members={members} config={config} admin={admin} mobile={mobile} />}
        {tab === "members" && admin && <Members bid={bid} members={members} flats={flats} config={config} onDeleteBuilding={onDeleteBuilding} onImportWater2026={onImportWater2026} canImportWater2026={canImportWater2026} mobile={mobile} onConfirm={(opts) => setConfirmModal(opts)} />}
      </main>

      {openFlat && (
        <Drawer onClose={() => setOpenFlat(null)}>
          <FlatStatement flat={openFlat} water={water} maint={maint} residential={residential} config={config} embedded />
        </Drawer>
      )}

      {publish && (
        <PublishModal kind={publish} text={snapshotText(publish)} poster={snapshotPoster(publish)}
          onDone={() => doPublish(publish)} onClose={() => setPublish(null)} />
      )}

      {(canWater || canMaint) && dirty && ["home", "dashboard", "water", "maintenance"].includes(tab) && (
        <div style={S.saveBar}>
          <div style={S.saveBarInner}>
            <span>${t("unsavedChanges")}</span>
            <span style={{ display: "flex", gap: 10 }}>
              <button className="ghostBtn" style={S.ghostBtn} onClick={onDiscard} disabled={saving}>Undo</button>
              <button className="primaryBtn" style={S.primaryBtn} onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </span>
          </div>
        </div>
      )}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(null); }} />}

      {!dirty && <footer style={{ ...S.footer, ...(mobile ? { paddingBottom: 70 } : {}) }}>Everyone sees updates the moment an editor saves.</footer>}

      {/* ===== MOBILE BOTTOM NAV ===== */}
      {mobile && !dirty && (
        <nav style={MB.bottomNav}>
          {[
            ["home", "🏠", t("home")],
            ["water", "💧", t("water")],
            ["maintenance", "🔧", t("maintenance")],
            ["community", "📊", t("community")],
          ].map(([k, icon, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...MB.bottomNavItem, ...(tab === k ? MB.bottomNavItemActive : {}) }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 10, marginTop: 2 }}>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function initialsOf(name) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}
function roleText(membership, admin, meFlat) {
  const parts = [];
  if (admin) parts.push("Admin");
  if (membership.roles?.includes("treasurer")) parts.push("Treasurer");
  if (membership.roles?.includes("water")) parts.push("Water");
  if (meFlat) parts.push(`Flat ${meFlat}`);
  return parts.join(" · ") || "Resident";
}

/* ============================= OVERVIEW ============================= */
function Overview({ water, maint, paidWater, paidMaint, waterPeriod, maintPeriod, residential, canWater, canMaint, admin, config, togglePaidWater, togglePaidMaint, openFlat, onShare, mobile, onBroadcast, bid }) {
  const payments = config?.payments || [];
  const outstanding = config?.outstanding || {};
  const corpus = maint.corpusMonthly || 0;
  const billable = water.rows.reduce((s, r) => s + r.bill, 0) + maint.total;

  // Payment-based status: compute per-flat due using recorded payments
  const flatDue = (flat) => {
    const w = water.rows.find((r) => r.flat === flat)?.bill || 0;
    const owed = maint.byMember[flat] || 0;
    const bill = w + maint.perFlat + corpus - owed;
    const prev = Number(outstanding[flat] || 0);
    const paid = payments.filter((p) => p.flat === flat).reduce((s, p) => s + Number(p.amount || 0), 0);
    return Math.max(0, bill + prev - paid);
  };
  const collected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const statusOf = (flat) => {
    const due = flatDue(flat);
    const bill = (water.rows.find((r) => r.flat === flat)?.bill || 0) + maint.perFlat + corpus;
    const paid = payments.filter((p) => p.flat === flat).reduce((s, p) => s + Number(p.amount || 0), 0);
    if (due <= 0) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  };
  const counts = residential.reduce((a, f) => { a[statusOf(f.flat)]++; return a; }, { paid: 0, partial: 0, unpaid: 0 });
  const tileBg = { paid: T.money, partial: T.partial, unpaid: T.unpaid };
  const perFloor = config?.perFloor || 3;
  const orderedFlats = [...residential].sort((a, b) => (b.floor - a.floor) || (a.unit - b.unit));

  return (
    <>
      {admin && (
        <div style={S.inviteBar}>
          <span>Invite code <b style={{ fontFamily: "monospace" }}>{config.inviteCode}</b> — share so neighbours can join.</span>
          <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "7px 14px" }} onClick={onShare}>Share on WhatsApp</button>
        </div>
      )}

      {admin && (
        <div style={{ ...S.inviteBar, marginTop: 0, background: "#E8F6EE", borderColor: T.money }}>
          <span>📢 Send bills to all residents via WhatsApp or copy messages.</span>
          <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "7px 14px", background: T.money }} onClick={onBroadcast}>Broadcast bills</button>
        </div>
      )}

      <div style={S.billingStrip}>
        <div style={S.billingCol}>
          <span style={S.billingKind}>💧 Water — current cycle</span>
          <span style={S.billingVal}>{waterPeriod.label}</span>
          <span style={S.billingDates}>{fmtDate(waterPeriod.start)} → {fmtDate(waterPeriod.end)}</span>
        </div>
        <div style={S.billingDivide} />
        <div style={S.billingCol}>
          <span style={S.billingKind}>🧰 Maintenance — current cycle</span>
          <span style={S.billingVal}>{maintPeriod.label}</span>
          <span style={S.billingDates}>{fmtDate(maintPeriod.start)} → {fmtDate(maintPeriod.end)}</span>
        </div>
      </div>
      <div style={S.cards}>
        <Card label="Water this period" value={money(water.grandTotal)} tone="water" note={water.costItems.length ? water.costItems.map((ci) => ci.label || "cost").join(" + ") : "no costs entered"} />
        <Card label="Maintenance this period" value={money(maint.total)} tone="ink" note={`${money(maint.perFlat)} per flat`} />
        <Card label="Total billable" value={money(billable)} tone="ink" note={`water + maintenance, ${residential.length} flats`} />
        <Card label="Collected" value={money(collected)} tone="money" note={`${Math.round((collected / (billable || 1)) * 100)}% of billable`} />
        {(() => {
          const c = config?.corpus || {};
          const cBal = Number(c.openingBalance || 0)
            + (c.ledger || []).filter((e) => e.type === "deposit").reduce((s, e) => s + Number(e.amount || 0), 0)
            - (c.ledger || []).filter((e) => e.type === "withdrawal").reduce((s, e) => s + Number(e.amount || 0), 0);
          const cMonthly = Number(c.monthly || 0);
          return (cBal > 0 || cMonthly > 0) ? (
            <Card label="Corpus fund" value={money(cBal)} tone="money"
              note={cMonthly > 0 ? `+ ${money(cMonthly)}/flat/month` : "reserve fund"} />
          ) : null;
        })()}
      </div>

      <SectionTitle>Collection status</SectionTitle>
      <div style={S.legend}>
        <span style={S.legendItem}><span style={{ ...S.legendDot, background: T.money }} /> Paid ({counts.paid})</span>
        <span style={S.legendItem}><span style={{ ...S.legendDot, background: T.partial }} /> Part paid ({counts.partial})</span>
        <span style={S.legendItem}><span style={{ ...S.legendDot, background: T.unpaid }} /> Unpaid ({counts.unpaid})</span>
      </div>
      <div style={{ ...S.tileGrid, gridTemplateColumns: `repeat(${perFloor}, 1fr)` }}>
        {orderedFlats.map((f) => {
          const st = statusOf(f.flat);
          return (
            <button key={f.flat} className="tile" onClick={() => openFlat(f.flat)}
              style={{ ...S.tile, background: tileBg[st], boxShadow: `inset 0 -4px 0 rgba(0,0,0,.16)` }}>
              {f.flat}<span style={S.tileSub}>{st === "paid" ? "paid" : st === "partial" ? "part" : "due"}</span>
            </button>
          );
        })}
      </div>

      <SectionTitle>Per-flat statement</SectionTitle>
      <PerFlatPayments residential={residential} water={water} maint={maint}
        config={config} bid={bid} admin={admin} canWater={canWater} canMaint={canMaint}
        paidWater={paidWater} paidMaint={paidMaint} togglePaidWater={togglePaidWater} togglePaidMaint={togglePaidMaint}
        openFlat={openFlat} mobile={mobile} />



      {Object.keys(maint.byMember).length > 0 && (
        <>
          <SectionTitle>Owed back to members <span style={S.titleHint}>— adhoc expenses fronted out of pocket</span></SectionTitle>
          <div style={S.reimbList}>
            {Object.entries(maint.byMember).map(([flat, amt]) => {
              const nm = residential.find((f) => f.flat === flat)?.name || flat;
              return (<div key={flat} style={S.reimbRow}><span><b>Flat {flat}</b> · {nm}</span><span style={{ ...S.num, color: T.owed, fontWeight: 700 }}>{money(amt)}</span></div>);
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ============================ WATER ============================ */
function WaterEntry({ water, setField, setReading, canEdit, periodStart, periodEnd, costItems, onSetCostItems, onSetMeter, onBackfill, showAdj, onToggleAdj, periods, selId, onSelect, isLatest, onPublish, publishedAt, onStartNext, onDeletePeriod, canDelete, startReady, saving, flats, mobile }) {
  const anyAdj = water.rows.some((r) => r.adj);
  const adjOn = showAdj || anyAdj;
  const [showCsv, setShowCsv] = useState(false);

  // Cost items editor helpers
  const addCostItem = () => {
    const id = "ci_" + Math.random().toString(36).slice(2, 8);
    onSetCostItems([...costItems, { id, label: "", quantity: "", rate: "", split: "equal" }]);
  };
  const updateCostItem = (id, key, val) => {
    onSetCostItems(costItems.map((ci) => ci.id === id ? { ...ci, [key]: val } : ci));
  };
  const removeCostItem = (id) => {
    onSetCostItems(costItems.filter((ci) => ci.id !== id));
  };

  return (
    <>


      {showCsv && (
        <CsvUpload existingFlats={flats}
          onApply={(map, target) => Object.entries(map).forEach(([flat, val]) => setReading(flat, target || "curr", String(val)))}
          onClose={() => setShowCsv(false)} />
      )}
      {!canEdit && <ViewNote>You have view access. Ask the water in-charge or admin to make changes.</ViewNote>}
      <PeriodControls kind="water" periodStart={periodStart} periodEnd={periodEnd} setField={setField} onBackfill={onBackfill}
        periods={periods} selId={selId} onSelect={onSelect} isLatest={isLatest}
        canEdit={canEdit} onStartNext={onStartNext} onDeletePeriod={onDeletePeriod} canDelete={canDelete} startReady={startReady} saving={saving} />

      <SectionTitle>This period's water costs</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {costItems.map((ci) => {
          const lineTotal = (Number(ci.quantity) || 0) * (Number(ci.rate) || 0);
          return (
            <div key={ci.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: mobile ? "12px 12px" : "12px 16px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ ...S.field, flex: "2 1 160px", minWidth: 0 }}>
                  <span style={S.fieldLabel}>Description</span>
                  <input className="cell" style={S.fieldInput} value={ci.label || ""} placeholder="e.g. Private Tanker"
                    readOnly={!canEdit} onChange={(e) => updateCostItem(ci.id, "label", e.target.value)} />
                </label>
                <label style={{ ...S.field, flex: "0 0 72px" }}>
                  <span style={S.fieldLabel}>Qty</span>
                  <input className="cell" style={S.fieldInput} type="number" value={ci.quantity} readOnly={!canEdit}
                    onChange={(e) => updateCostItem(ci.id, "quantity", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} />
                </label>
                <label style={{ ...S.field, flex: "0 0 100px" }}>
                  <span style={S.fieldLabel}>Rate (₹)</span>
                  <input className="cell" style={S.fieldInput} type="number" value={ci.rate} readOnly={!canEdit}
                    onChange={(e) => updateCostItem(ci.id, "rate", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} />
                </label>
                <div style={{ ...S.field, flex: "0 0 90px" }}>
                  <span style={S.fieldLabel}>Total</span>
                  <div style={{ ...S.fieldInput, background: "#F6F9F8", display: "flex", alignItems: "center", fontWeight: 700, fontFamily: mono }}>{money(lineTotal)}</div>
                </div>
                <label style={{ ...S.field, flex: "0 0 130px" }}>
                  <span style={S.fieldLabel}>Split by</span>
                  <select style={{ ...S.fieldInput, fontFamily: "inherit", fontSize: 14 }} value={ci.split || "equal"} disabled={!canEdit}
                    onChange={(e) => updateCostItem(ci.id, "split", e.target.value)}>
                    <option value="percent">% Utilization</option>
                    <option value="equal">Equally</option>
                  </select>
                </label>
                {canEdit && (
                  <button className="del" onClick={() => removeCostItem(ci.id)} title="Remove"
                    style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: T.muted, padding: "4px 8px", marginBottom: 4 }}>✕</button>
                )}
              </div>
            </div>
          );
        })}
        {canEdit && (
          <button className="add" style={{ ...S.addBtn, alignSelf: "flex-start" }} onClick={addCostItem}>+ Add cost item</button>
        )}
      </div>
      <div style={S.costStrip}>
        {water.costItems.map((ci, i) => (
          <React.Fragment key={ci.id || i}>
            {i > 0 && <span style={S.plus}>+</span>}
            <span>{ci.label || "Untitled"} <b style={S.num}>{money(ci.total)}</b></span>
          </React.Fragment>
        ))}
        {water.costItems.length > 0 && <><span style={S.plus}>=</span><span style={S.costTotal}>{money(water.grandTotal)}</span></>}
      </div>

      <div style={{ ...S.periodHead, ...(mobile ? { flexDirection: "column", alignItems: "stretch", gap: 8 } : {}) }}>
        <SectionTitle>Meter readings</SectionTitle>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {canEdit && !mobile && <label style={{ fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={adjOn} disabled={anyAdj} onChange={onToggleAdj} title={anyAdj ? "Shown because an adjustment is set" : "Show the per-flat adjustment column"} /> Adjustment column
          </label>}
          {canEdit && <button className="add" style={{ ...S.addBtn, ...(mobile ? { marginTop: 0, padding: "8px 12px", fontSize: 12.5 } : {}) }} onClick={() => setShowCsv(true)}>📄 Upload CSV</button>}

        </span>
      </div>

      {mobile ? (
        /* ---- MOBILE: card layout ---- */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {water.rows.map((r) => (
            <div key={r.flat} style={{ background: r.isCommon ? "#F5F8F8" : T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontFamily: display, fontWeight: 700, fontSize: 17 }}>{r.flat}</span>
                  <span style={{ fontSize: 12, color: T.muted, marginLeft: 8 }}>{r.meter || ""}</span>
                </div>
                <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: T.ink }}>{money(r.bill)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 3 }}>PREVIOUS</div>
                  <div style={{ fontFamily: mono, color: T.inkSoft }}>{(Number(r.prev) || 0).toFixed(1)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 3 }}>CURRENT</div>
                  {canEdit ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input className="cell" style={{ ...S.cellInput, width: "100%", fontSize: 14 }} type="number" value={r.curr}
                        onChange={(e) => setReading(r.flat, "curr", e.target.value)} />

                    </span>
                  ) : <span style={{ fontFamily: mono }}>{r.curr === "" ? "—" : Number(r.curr).toFixed(1)}</span>}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: T.inkSoft }}>
                <span>Used: <b style={{ fontFamily: mono, color: T.ink }}>{r.cons.toFixed(1)}</b></span>
                <span>Share: <b style={{ fontFamily: mono, color: T.water }}>{r.pct.toFixed(1)}%</b></span>
              </div>
            </div>
          ))}
          <div style={{ background: "#F7F7FC", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span>Total used: <span style={{ fontFamily: mono }}>{water.totalCons.toFixed(1)}</span></span>
            <span style={{ fontFamily: mono }}>{money(water.rows.reduce((s, r) => s + r.bill, 0))}</span>
          </div>
        </div>
      ) : (
        /* ---- DESKTOP: table layout ---- */
        <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Flat</th><th style={S.th}>Meter</th>
            <th style={{ ...S.th, textAlign: "right" }}>Previous</th>
            <th style={{ ...S.th, textAlign: "right" }}>Current</th>
            <th style={{ ...S.th, textAlign: "right" }}>Used</th>
            <th style={{ ...S.th, textAlign: "right" }}>%</th>
            {adjOn && <th style={{ ...S.th, textAlign: "right" }}>Adj.</th>}
            <th style={{ ...S.th, textAlign: "right" }}>Water bill</th>
          </tr></thead>
          <tbody>
            {water.rows.map((r) => (
              <tr key={r.flat} style={r.isCommon ? { background: "#F5F8F8" } : undefined}>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.flat}</td>
                <td style={{ ...S.td, fontSize: 12, padding: canEdit ? "4px 8px" : "10px 12px" }}>
                  {canEdit ? <input className="cell" style={{ ...S.cellInput, width: 84, fontFamily: mono, textAlign: "left" }} value={r.meter || ""} placeholder="serial" onChange={(e) => onSetMeter(r.flat, e.target.value)} />
                    : <span style={{ color: T.muted }}>{r.meter || "—"}</span>}
                </td>
                <td style={{ ...S.td, textAlign: "right", padding: canEdit ? "4px 8px" : "10px 12px" }}>
                  {canEdit ? <input className="cell" style={{ ...S.cellInput, background: "#F6F9FC" }} type="number" value={r.prev}
                      onChange={(e) => setReading(r.flat, "prev", e.target.value)} title="Opening reading — edit if the meter was reset or replaced" />
                    : <span style={{ ...S.num, color: T.muted }}>{(Number(r.prev) || 0).toFixed(1)}</span>}
                </td>
                <td style={{ ...S.td, textAlign: "right", padding: canEdit ? "4px 8px" : "10px 12px" }}>
                  {canEdit ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>

                      <input className="cell" style={S.cellInput} type="number" value={r.curr} onChange={(e) => setReading(r.flat, "curr", e.target.value)} />
                    </span>
                  ) : <span style={S.num}>{r.curr === "" ? "—" : Number(r.curr).toFixed(1)}</span>}
                </td>
                <td style={{ ...S.td, ...S.num }}>{r.cons.toFixed(1)}</td>
                <td style={{ ...S.td, ...S.num, color: T.water }}>{r.pct.toFixed(2)}</td>
                {adjOn && <td style={{ ...S.td, textAlign: "right", padding: canEdit ? "4px 8px" : "10px 12px" }}>
                  {canEdit ? <input className="cell" style={{ ...S.cellInput, width: 62 }} type="number" value={r.adj} onChange={(e) => setReading(r.flat, "adj", e.target.value)} />
                    : <span style={S.num}>{r.adj}</span>}
                </td>}
                <td style={{ ...S.td, ...S.num, fontWeight: 700, color: T.ink }}>{money(r.bill)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td style={S.tfoot} colSpan={4}>Totals</td>
            <td style={{ ...S.tfoot, ...S.num }}>{water.totalCons.toFixed(1)}</td>
            <td style={{ ...S.tfoot, ...S.num }}>100.00</td>
            {adjOn && <td style={S.tfoot}></td>}
            <td style={{ ...S.tfoot, ...S.num }}>{money(water.rows.reduce((s, r) => s + r.bill, 0))}</td>
          </tr></tfoot>
        </table>
        </div>
      )}
      <p style={S.note}>{water.rows.some((r) => r.isCommon) ? "Common/Watchman counts toward the general-tanker % but carries no Manjeera or connection share. " : ""}The Previous (opening) reading carries from last period but is editable — override it if a meter was reset or replaced.</p>
      {canEdit && <PublishBar onPublish={onPublish} publishedAt={publishedAt} kind="water" />}
      <PeriodBanner kind="Water" periodStart={periodStart} periodEnd={periodEnd} />
    </>
  );
}

/* ============================ MAINTENANCE ============================ */
function Maintenance({ maint, expenses, setExpenses, residential, canEdit, setField, periodStart, periodEnd, onBackfill, periods, selId, onSelect, isLatest, onPublish, publishedAt, onStartNext, onDeletePeriod, canDelete, startReady, saving, mobile, config, bid }) {
  const update = (id, key, val) => setExpenses((xs) => xs.map((e) => e.id === id ? { ...e, [key]: val } : e));
  const remove = (id) => {
    // If this expense was added by a special expense, revert the collection
    if (id.startsWith("e_sp_")) {
      const spId = id.replace("e_sp_", "");
      const allSp = config?.specialExpenses || [];
      const sp = allSp.find((s) => s.id === spId);
      if (sp) {
        const perMonth = Math.round(sp.amount / (sp.months || 1));
        const newCollected = Math.max(0, (sp.collected || 0) - perMonth);
        updateBuilding(bid, {
          specialExpenses: allSp.map((s) => s.id === spId
            ? { ...s, collected: newCollected, status: newCollected > 0 ? "collecting" : "pending", lastCollectedDate: null }
            : s)
        });
      }
    }
    setExpenses((xs) => xs.filter((e) => e.id !== id));
  };
  const add = () => setExpenses((xs) => [...xs, { id: "e" + Date.now(), item: "", amount: 0, paidBy: "fund" }]);

  return (
    <>
      {!canEdit && <ViewNote>You have view access. Ask the treasurer or admin to make changes.</ViewNote>}
      <PeriodControls kind="maintenance" periodStart={periodStart} periodEnd={periodEnd} setField={setField} onBackfill={onBackfill}
        periods={periods} selId={selId} onSelect={onSelect} isLatest={isLatest}
        canEdit={canEdit} onStartNext={onStartNext} onDeletePeriod={onDeletePeriod} canDelete={canDelete} startReady={startReady} saving={saving} />

      <div style={S.cards}>
        <Card label="Total maintenance spent" value={money(maint.total)} tone="ink" note={`${expenses.length} line items`} />
        <Card label="Calculated split" value={money(maint.calculated)} tone="ink" note={`₹${Math.round(maint.total)} ÷ ${residential.length} flats`} />
        <div style={S.card}>
          <div style={S.cardLabel}>Actual amount collected per flat</div>
          {canEdit ? (
            <input className="cell" type="number" style={{ ...S.cellInput, fontSize: 22, fontWeight: 700, fontFamily: mono, color: T.water, width: "100%", textAlign: "center", padding: "6px 8px" }}
              value={maint.charge != null ? maint.charge : ""}
              placeholder={String(Math.round(maint.calculated))}
              onChange={(e) => {
                const v = e.target.value;
                setField("chargePerFlat", v === "" ? null : Number(v));
              }} />
          ) : (
            <div style={{ ...S.cardValue, color: T.water, fontSize: 24 }}>{money(maint.perFlat)}</div>
          )}
          <div style={S.cardNote}>{maint.charge != null ? `₹${Math.round(maint.perFlat)} × ${residential.length} flats = ${money(maint.perFlat * residential.length)}` : "using calculated split"}</div>
        </div>
        <Card label="Owed to members" value={money(Object.values(maint.byMember).reduce((s, n) => s + n, 0))} tone="owed" note="adhoc expenses fronted" />
        {maint.surplus !== 0 && (
          <Card label={maint.surplus > 0 ? "Maintenance surplus" : "Maintenance deficit"}
            value={money(Math.abs(maint.surplus))}
            tone={maint.surplus > 0 ? "money" : "owed"}
            note={maint.corpusMonthly > 0
              ? `₹${Math.round(maint.perFlat)} collected − ₹${Math.round(maint.calculated)} expenses − ₹${maint.corpusMonthly} corpus = ₹${Math.round(maint.perFlat - maint.calculated - maint.corpusMonthly)}/flat`
              : (maint.surplus > 0 ? `₹${Math.round(maint.perFlat - maint.calculated)} extra per flat` : `₹${Math.round(maint.calculated - maint.perFlat)} less per flat`)} />
        )}
        <div style={S.card}>
          <div style={S.cardLabel}>{(() => {
            const sorted = [...periods].filter((p) => p.periodStart).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
            const curStart = sorted.find((p) => p.id === selId)?.periodStart || "";
            const prev = sorted.filter((p) => p.periodStart < curStart).pop();
            const prevLabel = prev ? labelFromStart(prev.periodStart) : "previous";
            return maint.carryForward >= 0 ? `Carry from ${prevLabel}` : `Deficit from ${prevLabel}`;
          })()}</div>
          {canEdit ? (
            <input className="cell" type="number" style={{ ...S.cellInput, fontSize: 22, fontWeight: 700, fontFamily: mono, color: maint.carryForward >= 0 ? T.money : T.owed, width: "100%", textAlign: "center", padding: "6px 8px" }}
              value={maint.carryForward || ""}
              placeholder="0"
              onChange={(e) => {
                const v = e.target.value;
                setField("carryForward", v === "" ? 0 : Number(v));
              }} />
          ) : (
            <div style={{ ...S.cardValue, color: maint.carryForward >= 0 ? T.money : T.owed, fontSize: 24 }}>{money(Math.abs(maint.carryForward))}</div>
          )}
          <div style={S.cardNote}>{maint.carryForward ? (maint.carryForward > 0 ? "surplus brought forward" : "shortfall brought forward") : "no carry — auto-set on next period"}</div>
        </div>
      </div>

      <SectionTitle>Expense items {canEdit && !mobile && <span style={S.titleHint}>— set "Paid by" to a flat when a member fronts the cost</span>}</SectionTitle>
      {mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expenses.map((e) => (
            <div key={e.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                {canEdit ? (
                  <input className="cell" style={{ ...S.cellInput, textAlign: "left", width: "100%", fontSize: 14 }} value={e.item} placeholder="e.g. Watchman salary" onChange={(ev) => update(e.id, "item", ev.target.value)} />
                ) : <span style={{ fontWeight: 600, fontSize: 14 }}>{e.item || "—"}</span>}
                {canEdit && <button className="del" style={{ ...S.del, fontSize: 16, flexShrink: 0 }} onClick={() => remove(e.id)}>✕</button>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 3 }}>AMOUNT</div>
                  {canEdit ? <input className="cell" style={{ ...S.cellInput, width: "100%", fontSize: 14 }} type="number" value={e.amount} onChange={(ev) => update(e.id, "amount", parseFloat(ev.target.value) || 0)} />
                    : <span style={{ fontFamily: mono, fontWeight: 600 }}>{money(e.amount)}</span>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 3 }}>PAID BY</div>
                  {canEdit ? <select className="cell" style={{ ...S.cellSelect, width: "100%", fontSize: 13 }} value={e.paidBy} onChange={(ev) => update(e.id, "paidBy", ev.target.value)}>
                      <option value="fund">Fund</option>
                      {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat}</option>)}
                    </select> : <span>{e.paidBy === "fund" ? "Fund" : `Flat ${e.paidBy}`}</span>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12.5, color: T.inkSoft }}>
                {canEdit
                  ? <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!e.recurring} onChange={(ev) => update(e.id, "recurring", ev.target.checked)} style={{ width: 15, height: 15 }} />
                      Repeats monthly
                    </label>
                  : <span style={{ color: e.recurring ? T.money : T.muted, fontWeight: 600 }}>{e.recurring ? "Monthly" : "One-off"}</span>}
              </div>
            </div>
          ))}
          <div style={{ background: "#F7F7FC", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span>Total</span>
            <span style={{ fontFamily: mono }}>{money(maint.total)}</span>
          </div>
        </div>
      ) : (
        <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Item</th><th style={{ ...S.th, textAlign: "right" }}>Amount</th><th style={S.th}>Paid by</th><th style={{ ...S.th, textAlign: "center" }}>Repeats monthly</th>{canEdit && <th style={S.th}></th>}</tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td style={{ ...S.td, padding: canEdit ? "4px 8px" : "10px 12px" }}>
                  {canEdit ? <input className="cell" style={{ ...S.cellInput, textAlign: "left", width: "100%", minWidth: 160 }} value={e.item} placeholder="e.g. Watchman salary" onChange={(ev) => update(e.id, "item", ev.target.value)} /> : (e.item || "—")}
                </td>
                <td style={{ ...S.td, padding: canEdit ? "4px 8px" : "10px 12px", textAlign: "right" }}>
                  {canEdit ? <input className="cell" style={{ ...S.cellInput, width: 90 }} type="number" value={e.amount} onChange={(ev) => update(e.id, "amount", parseFloat(ev.target.value) || 0)} /> : <span style={S.num}>{money(e.amount)}</span>}
                </td>
                <td style={{ ...S.td, padding: canEdit ? "4px 8px" : "10px 12px" }}>
                  {canEdit ? <select className="cell" style={S.cellSelect} value={e.paidBy} onChange={(ev) => update(e.id, "paidBy", ev.target.value)}>
                      <option value="fund">Association fund</option>
                      {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} — {f.name}</option>)}
                    </select> : (e.paidBy === "fund" ? "Association fund" : `Flat ${e.paidBy}`)}
                </td>
                <td style={{ ...S.td, textAlign: "center" }}>
                  {canEdit
                    ? <input type="checkbox" checked={!!e.recurring} onChange={(ev) => update(e.id, "recurring", ev.target.checked)} title="Carry this item into next month" style={{ width: 16, height: 16, cursor: "pointer" }} />
                    : <span style={{ color: e.recurring ? T.money : T.muted, fontSize: 12, fontWeight: 600 }}>{e.recurring ? "monthly" : "one-off"}</span>}
                </td>
                {canEdit && <td style={{ ...S.td, textAlign: "center" }}><button className="del" style={S.del} onClick={() => remove(e.id)}>✕</button></td>}
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td style={S.tfoot}>Total</td><td style={{ ...S.tfoot, ...S.num }}>{money(maint.total)}</td><td style={S.tfoot} colSpan={canEdit ? 3 : 2}></td></tr></tfoot>
        </table>
        </div>
      )}
      {canEdit && <button className="add" style={S.addBtn} onClick={add}>+ Add expense</button>}

      {/* ---- Corpus Fund ---- */}
      <CorpusFund config={config} bid={bid} canEdit={canEdit} nRes={residential.length} mobile={mobile} />

      <SpecialExpenses config={config} bid={bid} canEdit={canEdit} expenses={expenses} setExpenses={setExpenses} />

      {canEdit && <PublishBar onPublish={onPublish} publishedAt={publishedAt} kind="maintenance" />}
      <PeriodBanner kind="Maintenance" periodStart={periodStart} periodEnd={periodEnd} />
    </>
  );
}



/* ---- Per-flat payment tracking with outstanding balances ---- */
function PerFlatPayments({ residential, water, maint, config, bid, admin, canWater, canMaint,
  paidWater, paidMaint, togglePaidWater, togglePaidMaint, openFlat, mobile }) {
  const [payingFlat, setPayingFlat] = React.useState(null); // flat being paid
  const [payAmt, setPayAmt] = React.useState("");
  const [payNote, setPayNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const outstanding = config?.outstanding || {};
  const payments = config?.payments || [];
  const corpus = maint.corpusMonthly || 0;

  const doRecord = async (flat, totalDue) => {
    const amount = Number(payAmt) || 0;
    if (amount <= 0) return;
    setSaving(true);
    try {
      const month = [water.rows[0]?.periodLabel, maint.periodLabel].filter(Boolean).join("/") || "current";
      await recordPayment(bid, flat, amount, new Date().toISOString().slice(0, 10), payNote.trim(), month);
      setPayingFlat(null); setPayAmt(""); setPayNote("");
    } catch (e) { alert("Error: " + (e?.message || "unknown")); }
    finally { setSaving(false); }
  };

  const undoLastPayment = async (flat) => {
    if (saving) return;
    setSaving(true);
    try {
      // Use fresh config from props (re-read on each render)
      const current = config?.payments || [];
      const flatPays = current.filter((p) => p.flat === flat);
      if (!flatPays.length) { setSaving(false); return; }
      const last = flatPays[flatPays.length - 1];
      const updated = current.filter((p) => p.id !== last.id);
      await updateBuilding(bid, { payments: updated });
    } catch (e) { alert("Undo failed: " + (e?.message || "")); }
    finally { setSaving(false); }
  };

  const rows = residential.map((f) => {
    const w = water.rows.find((r) => r.flat === f.flat)?.bill || 0;
    const owed = maint.byMember[f.flat] || 0;
    const currentBill = w + maint.perFlat + corpus - owed;
    const prevOutstanding = Number(outstanding[f.flat] || 0);
    const flatPayments = payments.filter((p) => p.flat === f.flat);
    const totalPaid = flatPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalDue = Math.max(0, currentBill + prevOutstanding - totalPaid);
    const recentPayments = flatPayments.slice(-3);
    return { ...f, w, owed, currentBill, prevOutstanding, totalPaid, totalDue, recentPayments };
  });

  const totalOutstanding = rows.reduce((s, r) => s + Math.max(0, r.totalDue), 0);
  const totalPrevOutstanding = rows.reduce((s, r) => s + r.prevOutstanding, 0);

  return (
    <>
      {totalPrevOutstanding > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px",
          background: "#FDF2F0", border: "1px solid #F5D0C5", borderRadius: 10, marginBottom: 10, fontSize: 13.5 }}>
          <span style={{ color: T.owed, fontWeight: 600 }}>Total outstanding from previous months</span>
          <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: T.owed }}>{money(totalPrevOutstanding)}</span>
        </div>
      )}

      {mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => (
            <div key={r.flat} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px",
              boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
                onClick={() => openFlat(r.flat)}>
                <div>
                  <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16 }}>{r.flat}</span>
                  <span style={{ fontSize: 13, color: T.inkSoft, marginLeft: 8 }}>{r.name || ""}</span>
                </div>
                <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: r.totalDue <= 0 ? T.money : T.ink }}>
                  {r.totalDue <= 0 ? "Paid" : money(r.totalDue)}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>
                <span>Water: <b>{money(r.w)}</b></span>
                <span>Maint: <b>{money(maint.perFlat)}</b></span>
                {corpus > 0 && <span>Corpus: <b>{money(corpus)}</b></span>}
                {r.prevOutstanding > 0 && <span style={{ color: T.owed }}>Previous: <b>{money(r.prevOutstanding)}</b></span>}
              </div>
              {(admin || canWater || canMaint) && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {payingFlat === r.flat ? (
                    <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                      <input className="cell" type="number" style={{ ...S.cellInput, flex: "1 0 80px", fontSize: 14 }}
                        value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                        placeholder={String(Math.round(r.totalDue))} autoFocus />
                      <input className="cell" style={{ ...S.cellInput, flex: "1 0 80px", textAlign: "left", fontSize: 13 }}
                        value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (UPI/Cash)" />
                      <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "6px 12px", fontSize: 12 }}
                        disabled={saving} onClick={() => doRecord(r.flat, r.totalDue)}>
                        {saving ? "..." : "✓"}
                      </button>
                      <button style={{ border: "none", background: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}
                        onClick={() => setPayingFlat(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                    <button style={{ border: `1px solid ${T.money}`, background: r.totalDue <= 0 ? "#E8F6EE" : "#fff", color: T.money,
                      borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                      onClick={(e) => { e.stopPropagation(); setPayingFlat(r.flat); setPayAmt(String(Math.round(r.totalDue || r.currentBill))); }}>
                      {r.totalDue <= 0 ? "✓ Paid" : "Record payment"}
                    </button>
                    {r.totalPaid > 0 && (
                      <button style={{ border: "none", background: "none", color: T.muted, cursor: "pointer", fontSize: 11, textDecoration: "underline" }}
                        onClick={(e) => { e.stopPropagation(); undoLastPayment(r.flat); }}>undo</button>
                    )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Flat</th>
              <th style={S.th}>Name</th>
              <th style={{ ...S.th, textAlign: "right" }}>This month</th>
              <th style={{ ...S.th, textAlign: "right" }}>Outstanding</th>
              <th style={{ ...S.th, textAlign: "right" }}>Total due</th>
              <th style={{ ...S.th, textAlign: "center" }}>Payment</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.flat} className="row">
                  <td style={{ ...S.td, fontWeight: 600, cursor: "pointer" }} onClick={() => openFlat(r.flat)}>{r.flat}</td>
                  <td style={{ ...S.td, cursor: "pointer" }} onClick={() => openFlat(r.flat)}>{r.name || "—"}</td>
                  <td style={{ ...S.td, ...S.num }}>{money(r.currentBill)}</td>
                  <td style={{ ...S.td, ...S.num, color: r.prevOutstanding > 0 ? T.owed : T.muted }}>{r.prevOutstanding > 0 ? money(r.prevOutstanding) : "—"}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700, color: r.totalDue <= 0 ? T.money : T.ink }}>
                    {r.totalDue <= 0 ? "✓ Paid" : money(r.totalDue)}
                  </td>
                  <td style={{ ...S.td, textAlign: "center", padding: "4px 8px" }}>
                    {(admin || canWater || canMaint) ? (
                      payingFlat === r.flat ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                          <input className="cell" type="number" style={{ ...S.cellInput, width: 90, fontSize: 13 }}
                            value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                            placeholder={String(Math.round(r.totalDue))} autoFocus />
                          <input className="cell" style={{ ...S.cellInput, width: 80, textAlign: "left", fontSize: 12 }}
                            value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note" />
                          <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "5px 10px", fontSize: 12 }}
                            disabled={saving} onClick={() => doRecord(r.flat, r.totalDue)}>{saving ? "..." : "✓"}</button>
                          <button style={{ border: "none", background: "none", color: T.muted, cursor: "pointer" }}
                            onClick={() => setPayingFlat(null)}>✕</button>
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <button style={{ border: `1px solid ${r.totalDue <= 0 ? T.money : T.line}`, background: r.totalDue <= 0 ? "#E8F6EE" : "#fff",
                            color: r.totalDue <= 0 ? T.money : T.water, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                            cursor: "pointer", fontFamily: font, minWidth: 70 }}
                            onClick={() => { setPayingFlat(r.flat); setPayAmt(String(Math.round(r.totalDue || r.currentBill))); }}>
                            {r.totalDue <= 0 ? "✓ Paid" : "Record"}
                          </button>
                          {r.totalPaid > 0 && (
                            <button style={{ border: "none", background: "none", color: T.muted, cursor: "pointer", fontSize: 10, textDecoration: "underline", padding: 0 }}
                              onClick={() => undoLastPayment(r.flat)} title="Undo last payment">undo</button>
                          )}
                        </div>
                      )
                    ) : (
                      <span style={{ fontSize: 12, color: r.totalDue <= 0 ? T.money : T.muted }}>
                        {r.totalDue <= 0 ? "✓" : "Pending"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ---- Corpus Fund section ---- */
function CorpusFund({ config, bid, canEdit, nRes, mobile }) {
  const corpus = config?.corpus || { monthly: 0, openingBalance: 0, ledger: [], monthlyCollected: 0 };
  const ledger = corpus.ledger || [];
  const [localMonthly, setLocalMonthly] = React.useState(String(corpus.monthly || ""));
  const [localOpening, setLocalOpening] = React.useState(String(corpus.openingBalance || ""));
  const [saved, setSaved] = React.useState(false);
  const [adding, setAdding] = React.useState(null);
  const [desc, setDesc] = React.useState("");
  const [amt, setAmt] = React.useState("");

  // Sync local state when config changes from Firestore
  React.useEffect(() => { setLocalMonthly(String(corpus.monthly || "")); }, [corpus.monthly]);
  React.useEffect(() => { setLocalOpening(String(corpus.openingBalance || "")); }, [corpus.openingBalance]);

  const monthly = Number(corpus.monthly || 0);
  const opening = Number(corpus.openingBalance || 0);
  const depositsTotal = ledger.filter((e) => e.type === "deposit").reduce((s, e) => s + Number(e.amount || 0), 0);
  const withdrawalsTotal = ledger.filter((e) => e.type === "withdrawal").reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = opening + depositsTotal - withdrawalsTotal;

  const save = (patch) => {
    updateBuilding(bid, { corpus: { ...corpus, ...patch } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveMonthly = () => {
    const v = Number(localMonthly) || 0;
    if (v !== monthly) save({ monthly: v });
  };
  const saveOpening = () => {
    const v = Number(localOpening) || 0;
    if (v !== opening) save({ openingBalance: v });
  };

  const submitEntry = () => {
    if (!desc.trim() || !amt || Number(amt) <= 0) return;
    const entry = { id: "c_" + Math.random().toString(36).slice(2, 8), type: adding, amount: Number(amt), description: desc.trim(), date: new Date().toISOString().slice(0, 10) };
    save({ ledger: [...ledger, entry] });
    setAdding(null); setDesc(""); setAmt("");
  };

  const removeEntry = (id) => {
    save({ ledger: ledger.filter((e) => e.id !== id) });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SectionTitle>Corpus Fund</SectionTitle>
        {saved && <span style={{ fontSize: 12, color: T.money, fontWeight: 700, animation: "none" }}>✓ Saved</span>}
      </div>
      <div style={S.cards}>
        <div style={S.card}>
          <div style={S.cardLabel}>Monthly corpus per flat</div>
          {canEdit ? (
            <input className="cell" type="number"
              style={{ ...S.cellInput, fontSize: 20, fontWeight: 700, fontFamily: mono, color: T.water, width: "100%", textAlign: "center", padding: "6px 8px" }}
              value={localMonthly} placeholder="0"
              onChange={(e) => setLocalMonthly(e.target.value)}
              onBlur={saveMonthly}
              onKeyDown={(e) => e.key === "Enter" && saveMonthly()} />
          ) : (
            <div style={{ ...S.cardValue, color: T.water, fontSize: 22 }}>{money(monthly)}</div>
          )}
          <div style={S.cardNote}>{monthly > 0 ? `${money(monthly)} per flat × ${nRes} flats = ${money(monthly * nRes)} collected/month` : "enter amount to start collecting"}</div>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}>Opening balance</div>
          {canEdit ? (
            <input className="cell" type="number"
              style={{ ...S.cellInput, fontSize: 20, fontWeight: 700, fontFamily: mono, color: T.money, width: "100%", textAlign: "center", padding: "6px 8px" }}
              value={localOpening} placeholder="0"
              onChange={(e) => setLocalOpening(e.target.value)}
              onBlur={saveOpening}
              onKeyDown={(e) => e.key === "Enter" && saveOpening()} />
          ) : (
            <div style={{ ...S.cardValue, color: T.money, fontSize: 22 }}>{money(opening)}</div>
          )}
          <div style={S.cardNote}>before this app</div>
        </div>
        <Card label="Total corpus" value={money(balance)} tone={balance >= 0 ? "money" : "owed"}
          note={`${money(opening)} previous + ${money(depositsTotal)} deposits − ${money(withdrawalsTotal)} spent`} />
      </div>

      {ledger.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, marginBottom: 10 }}>
          {ledger.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              background: e.type === "deposit" ? "#E8F6EE" : "#FCEAE4", borderRadius: 8, padding: "10px 14px" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{e.type === "deposit" ? "↗ " : "↙ "}{e.description}</span>
                <span style={{ fontSize: 12, color: T.muted, marginLeft: 8 }}>{e.date || ""}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 15, color: e.type === "deposit" ? T.money : T.owed }}>
                  {e.type === "deposit" ? "+" : "−"}{money(e.amount)}
                </span>
                {canEdit && <button className="del" style={S.del} onClick={() => removeEntry(e.id)}>✕</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ background: adding === "deposit" ? "#F0FAF4" : "#FDF5F3", border: `1.5px solid ${adding === "deposit" ? T.money : T.owed}`,
          borderRadius: 12, padding: "14px 16px", marginTop: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: adding === "deposit" ? T.money : T.owed }}>
            {adding === "deposit" ? "↗ New deposit" : "↙ New withdrawal"}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ flex: "2 1 200px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, display: "block", marginBottom: 4 }}>Description</span>
              <input className="cell" style={{ ...S.cellInput, width: "100%", textAlign: "left" }} value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder={adding === "deposit" ? "e.g. Painting fund collection" : "e.g. Lift repair payment"} />
            </label>
            <label style={{ flex: "0 0 140px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, display: "block", marginBottom: 4 }}>Amount (₹)</span>
              <input className="cell" type="number" style={{ ...S.cellInput, width: "100%" }} value={amt}
                onChange={(e) => setAmt(e.target.value)} placeholder="0" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={S.ghostBtn2} onClick={() => { setAdding(null); setDesc(""); setAmt(""); }}>Cancel</button>
            <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "8px 20px", opacity: desc.trim() && Number(amt) > 0 ? 1 : 0.5 }}
              disabled={!desc.trim() || !Number(amt)} onClick={submitEntry}>
              {adding === "deposit" ? "Add deposit" : "Record withdrawal"}
            </button>
          </div>
        </div>
      )}

      {canEdit && !adding && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: ledger.length > 0 ? 0 : 12 }}>
          <button className="add" style={S.addBtn} onClick={() => setAdding("deposit")}>+ One-time deposit</button>
          <button className="add" style={{ ...S.addBtn, color: T.owed, borderColor: T.owed }} onClick={() => setAdding("withdrawal")}>− Withdrawal</button>
        </div>
      )}
    </>
  );
}


/* ---- Special / Ad-hoc Expenses (not tied to a month) ---- */
function SpecialExpenses({ config, bid, canEdit, expenses, setExpenses }) {
  const items = (config?.specialExpenses || []).filter((i) => i.status !== "completed");
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [months, setMonths] = React.useState("1");

  const allItems = config?.specialExpenses || [];
  const save = (list) => { updateBuilding(bid, { specialExpenses: list }); };

  const addItem = () => {
    if (!title.trim() || !Number(amount)) return;
    const entry = {
      id: "sp_" + Math.random().toString(36).slice(2, 8),
      title: title.trim(), amount: Number(amount),
      months: Math.max(1, parseInt(months) || 1),
      collected: 0, status: "pending",
      date: new Date().toISOString().slice(0, 10),
    };
    save([...allItems, entry]);
    setTitle(""); setAmount(""); setMonths("1"); setAdding(false);
  };

    const addToMaintenance = (item) => {
    // Guard: don't collect if already collected this period or fully collected
    const alreadyCollected = (item.collected || 0) >= item.amount;
    const collectedThisPeriod = item.lastCollectedDate && expenses.some((e) => e.item && e.item.includes(item.title));
    if (alreadyCollected || collectedThisPeriod) return;

    const perMonth = Math.round(item.amount / (item.months || 1));
    const isMultiMonth = (item.months || 1) > 1;
    const isFirstTime = !item.collected || item.collected === 0;

    if (isFirstTime) {
      // First collection: add expense (recurring if multi-month)
      const newExp = {
        id: "e_sp_" + item.id,
        item: item.title + (isMultiMonth ? " (" + money(perMonth) + "/month)" : ""),
        amount: perMonth,
        paidBy: "fund",
        recurring: isMultiMonth,
      };
      setExpenses((xs) => [...xs, newExp]);
    }
    // else: recurring expense already exists from previous period, just track collection

    const newCollected = Math.min(item.amount, (item.collected || 0) + perMonth);
    const done = newCollected >= item.amount;
    save(allItems.map((i) => i.id === item.id
      ? { ...i, status: done ? "completed" : "collecting", collected: newCollected, lastCollectedDate: new Date().toISOString().slice(0, 10) }
      : i));
  };

const payFromCorpus = (item) => {
    const corpus = config?.corpus || { monthly: 0, openingBalance: 0, ledger: [] };
    const withdrawal = {
      id: "c_" + Math.random().toString(36).slice(2, 8),
      type: "withdrawal", amount: item.amount,
      description: item.title,
      date: new Date().toISOString().slice(0, 10),
    };
    updateBuilding(bid, { corpus: { ...corpus, ledger: [...(corpus.ledger || []), withdrawal] } });
    save(allItems.map((i) => i.id === item.id ? { ...i, status: "completed", collected: item.amount } : i));
  };

  const markComplete = (id) => {
    save(allItems.map((i) => i.id === id ? { ...i, status: "completed" } : i));
  };

  const removeItem = (id) => { save(allItems.filter((i) => i.id !== id)); };

  if (!canEdit && items.length === 0) return null;

  return (
    <>
      <SectionTitle>Special Expenses</SectionTitle>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "-4px 0 10px" }}>
        One-time expenses not tied to any month. Collect through maintenance or pay from corpus.
      </p>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {items.map((item) => {
            const perMonth = Math.round(item.amount / (item.months || 1));
            const pct = item.amount > 0 ? Math.min(100, Math.round(((item.collected || 0) / item.amount) * 100)) : 0;
            return (
              <div key={item.id} style={{
                background: item.status === "pending" ? T.surface : item.status === "collecting" ? "#EEF4FF" : "#F0FAF4",
                border: `1px solid ${item.status === "pending" ? T.line : item.status === "collecting" ? T.water : T.money}`,
                borderRadius: 10, padding: "10px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                      {item.date}
                      {(item.months || 1) > 1 && ` · ${money(perMonth)}/month × ${item.months} months`}
                    </div>
                  </div>
                  <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 15 }}>{money(item.amount)}</span>
                </div>

                {item.status === "collecting" && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.inkSoft, marginBottom: 4 }}>
                      <span>Collected: {money(item.collected || 0)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#E2E8F0" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: T.water, width: pct + "%", transition: "width 0.3s" }} />
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {item.status === "pending" && (
                      <>
                        <button style={{ border: `1px solid ${T.water}`, background: "#fff", color: T.water, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                          onClick={() => addToMaintenance(item)}>
                          {(item.months || 1) > 1 ? `+ Add ${money(perMonth)} to maintenance` : "+ Add to maintenance"}
                        </button>
                        <button style={{ border: `1px solid ${T.money}`, background: "#fff", color: T.money, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                          onClick={() => payFromCorpus(item)}>Pay from corpus</button>
                      </>
                    )}
                    {item.status === "collecting" && (
                      <>
                        {expenses.some((e) => e.item && e.item.includes(item.title)) ? (
                          <span style={{ fontSize: 12, color: T.money, fontWeight: 600 }}>✓ Collected this period</span>
                        ) : (item.collected || 0) >= item.amount ? (
                          <span style={{ fontSize: 12, color: T.money, fontWeight: 600 }}>✓ Fully collected</span>
                        ) : (
                          <button style={{ border: `1px solid ${T.water}`, background: "#fff", color: T.water, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                            onClick={() => addToMaintenance(item)}>+ Collect next {money(perMonth)}</button>
                        )}
                        <button style={{ border: `1px solid ${T.money}`, background: "#fff", color: T.muted, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                          onClick={() => markComplete(item.id)}>Mark complete</button>
                      </>
                    )}
                    <button className="del" style={S.del} onClick={() => removeItem(item.id)}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div style={{ background: "#FAFBFE", border: `1.5px solid ${T.water}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ flex: "2 1 180px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, display: "block", marginBottom: 4 }}>What is it for?</span>
              <input className="cell" style={{ ...S.cellInput, width: "100%", textAlign: "left" }} value={title}
                onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rain water harvesting" autoFocus />
            </label>
            <label style={{ flex: "0 0 120px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, display: "block", marginBottom: 4 }}>Total cost</span>
              <input className="cell" type="number" style={{ ...S.cellInput, width: "100%" }} value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </label>
            <label style={{ flex: "0 0 100px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, display: "block", marginBottom: 4 }}>Months</span>
              <input className="cell" type="number" style={{ ...S.cellInput, width: "100%" }} value={months}
                onChange={(e) => setMonths(e.target.value)} placeholder="1" min="1" />
            </label>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
            {Number(amount) > 0 && parseInt(months) > 1
              ? `${money(Math.round(Number(amount) / parseInt(months)))}/month added to maintenance for ${months} months`
              : Number(amount) > 0 ? `Full amount added to one maintenance period` : ""}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={S.ghostBtn2} onClick={() => { setAdding(false); setTitle(""); setAmount(""); setMonths("1"); }}>Cancel</button>
            <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "8px 20px", opacity: title.trim() && Number(amount) > 0 ? 1 : 0.5 }}
              disabled={!title.trim() || !Number(amount)} onClick={addItem}>Add expense</button>
          </div>
        </div>
      )}

      {canEdit && !adding && (
        <button className="add" style={S.addBtn} onClick={() => setAdding(true)}>+ Add special expense</button>
      )}
    </>
  );
}


/* ===================== shared period controls ===================== */
function PeriodControls({ kind, periodStart, periodEnd, setField, onBackfill, periods, selId, onSelect, isLatest, canEdit, onStartNext, onDeletePeriod, canDelete, startReady, saving }) {
  const isMaint = kind === "maintenance";
  const setStart = (v) => setField("periodStart", v);
  const startNext = () => {
    const msg = isMaint
      ? "Start the next maintenance period?\n\nIt closes this month (moves to History) and opens the next calendar month. Expense items carry over. This does NOT affect the water period."
      : "Start the next water period?\n\nIt closes this period (moves to History) and opens a new, blank one. Opening readings carry from this period's closing readings. This does NOT affect the maintenance period.";
    if (window.confirm(msg)) onStartNext();
  };
  const removePeriod = () => {
    if (window.confirm(`Delete this ${kind} period?\n\nThe previous ${kind} period becomes current again. This cannot be undone.`)) onDeletePeriod();
  };
  // newest first for the picker
  const opts = (periods || []).slice().sort((a, b) => {
    if (!a.periodEnd && b.periodEnd) return -1;
    if (a.periodEnd && !b.periodEnd) return 1;
    return (b.periodEnd || "").localeCompare(a.periodEnd || "");
  });
  const datedOpts = opts.filter((p) => p.periodEnd);
  const currentId = datedOpts.length ? datedOpts[0].id : null; // latest dated = current bill
  const labelFor = (p) => `${labelFromStart(p.periodStart) || "New period"} · ${p.periodStart ? fmtDate(p.periodStart) : "—"} → ${p.periodEnd ? fmtDate(p.periodEnd) : "—"}`;
  const tag = (p) => (p.id === currentId ? "  (current)" : !p.periodEnd ? "  (new draft)" : "");
  return (
    <>
      <div style={S.periodHead}>
        <SectionTitle>{isMaint ? "Maintenance period" : "Water period"} <span style={S.titleHint}>— {isMaint ? "calendar month" : "named by its start month"}</span></SectionTitle>
        {canEdit && (
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onBackfill && <button className="del" style={S.backfillBtn} onClick={onBackfill} disabled={saving} title="Add a blank period for a past (or any) month">+ Backfill a month</button>}
            {canDelete && <button className="del" style={S.delPeriodBtn} onClick={removePeriod} disabled={saving}>Delete this period</button>}
            <button className="add" style={{ ...S.addBtn, opacity: (startReady && isLatest) ? 1 : .5, cursor: (startReady && isLatest) ? "pointer" : "not-allowed" }}
              onClick={startNext} disabled={saving || !startReady || !isLatest}
              title={!isLatest ? "Switch to the latest period to start a new one" : (startReady ? "" : "Fill in and save this period's dates first")}>
              {saving ? "Working…" : `Start next ${isMaint ? "maintenance" : "water"} period →`}
            </button>
          </span>
        )}
      </div>

      {opts.length >= 1 && (
        <div style={S.periodPickRow}>
          <label style={S.periodPickLabel}>Editing period</label>
          <select value={selId} onChange={(e) => onSelect(e.target.value)} style={S.periodPickSelect}>
            {opts.map((p, i) => (
              <option key={p.id} value={p.id} style={{ color: T.ink, background: "#fff" }}>
                {labelFor(p)}{tag(p)}
              </option>
            ))}
          </select>
          {opts.length === 1 && <span style={S.periodPickNote}>Add or backfill periods and they'll appear here to select & edit.</span>}
          {!isLatest && opts.length > 1 && <span style={S.periodPickNote}>You're editing a past period — changes save back to that month.</span>}
        </div>
      )}

      <div style={S.inputGrid}>
        <DateField label="From (start of period)" value={periodStart} onChange={setStart} readOnly={!canEdit} />
        <DateField label={isMaint ? "To (end of month)" : "To (meter reading date)"} value={periodEnd} onChange={(v) => setField("periodEnd", v)} readOnly={!canEdit} />
        {daysBetween(periodStart, periodEnd) != null && (
          <div style={{ display: "flex", alignItems: "center", paddingTop: 18 }}>
            <span style={{ background: T.accent + "18", color: T.accent, fontWeight: 700, fontSize: 14, padding: "6px 14px", borderRadius: 20, fontFamily: mono, whiteSpace: "nowrap" }}>
              {daysBetween(periodStart, periodEnd)} days
            </span>
          </div>
        )}
      </div>
    </>
  );
}
function PeriodBanner({ kind, periodStart, periodEnd }) {
  return (
    <div style={S.periodBanner}>
      <span style={S.periodLabel}>{kind} period</span>
      <span style={S.periodDates}>{fmtDate(periodStart)} &nbsp;→&nbsp; {fmtDate(periodEnd)}</span>
    </div>
  );
}
function DateField({ label, value, onChange, readOnly }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      <input type="date" value={value || ""} readOnly={readOnly} onChange={(e) => onChange(e.target.value)}
        style={{ ...S.fieldInput, fontFamily: "inherit", fontSize: 14, background: readOnly ? "#F7F7FC" : "#fff" }} />
    </label>
  );
}

/* ========================= FLAT STATEMENT ========================= */
function FlatStatement({ flat, water, maint, residential, config, embedded }) {
  const w = water.rows.find((r) => r.flat === flat);
  const f = residential.find((x) => x.flat === flat);
  if (!w || !f) return <div style={{ color: T.muted }}>No statement for this flat yet.</div>;
  const corpus = maint.corpusMonthly || 0;
  const total = w.bill + maint.perFlat + corpus;
  const owedBack = maint.byMember[flat] || 0;
  const net = total - owedBack;

  const allPayments = (config?.payments || []).filter((p) => p.flat === flat);
  const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const prevOutstanding = Number((config?.outstanding || {})[flat] || 0);
  const balance = Math.max(0, net + prevOutstanding - totalPaid);

  const Line = ({ label, val, sub, strong, color }) => (
    <div style={{ ...S.stLine, ...(strong ? S.stLineStrong : {}) }}>
      <div><div>{label}</div>{sub && <div style={S.stSub}>{sub}</div>}</div>
      <div style={{ ...S.num, fontWeight: strong ? 700 : 500, ...(color ? { color } : {}) }}>{typeof val === "string" ? val : money(val)}</div>
    </div>
  );
  return (
    <div style={embedded ? {} : S.stWrap}>
      <div style={S.stHead}>
        <div><div style={S.stFlat}>Flat {flat}</div><div style={S.stName}>{f.name || "—"}</div></div>
        <div style={S.stTotalBox}>
          <div style={S.stTotalLabel}>{balance <= 0 ? "✓ Paid" : "Balance due"}</div>
          <div style={{ ...S.stTotal, color: balance <= 0 ? T.money : T.ink }}>{balance <= 0 ? "✓" : money(balance)}</div>
        </div>
      </div>
      <div style={S.stGroup}>Water — {money(w.bill)}</div>
      {(w.itemShares || []).map((is) => (
        <Line key={is.id} label={is.label || "Water cost"} sub={is.share === 0 ? "—" : undefined} val={is.share} />
      ))}
      {w.adj !== 0 && <Line label="Adjustment" val={w.adj} />}
      <div style={S.stGroup}>Maintenance — {money(maint.perFlat)}</div>
      <Line label="Common maintenance" sub={money(maint.total) + " total ÷ " + residential.length} val={maint.perFlat} />
      {corpus > 0 && <Line label="Corpus contribution" val={corpus} />}
      <Line label="Subtotal" val={total} />
      {owedBack > 0 && <Line label="Less: expenses you fronted" sub="reimbursed from the fund" val={-owedBack} />}
      {prevOutstanding > 0 && <Line label="Outstanding from previous" val={prevOutstanding} color={T.owed} />}
      <Line label="Total bill" val={net + prevOutstanding} strong />

      {allPayments.length > 0 && (
        <>
          <div style={S.stGroup}>Payments</div>
          {allPayments.map((p) => (
            <Line key={p.id} label={"Paid " + (p.date || "") + (p.note ? " (" + p.note + ")" : "")} val={"-" + money(p.amount)} color={T.money} />
          ))}
          <Line label="Total paid" val={"-" + money(totalPaid)} color={T.money} />
        </>
      )}

      <Line label={balance <= 0 ? "✓ Fully paid" : "Remaining balance"} val={balance <= 0 ? "₹0" : money(balance)} strong color={balance <= 0 ? T.money : T.owed} />

      {owedBack > 0 && <div style={S.stOwed}>You fronted <b>{money(owedBack)}</b> in adhoc expenses. It's credited against your share.</div>}
    </div>
  );
}
/* ============================ small parts ============================ */
function Card({ label, value, note, tone }) {
  const accent = tone === "water" ? T.water : tone === "money" ? T.money : tone === "owed" ? T.owed : T.ink;
  return (<div style={S.card}><div style={S.cardLabel}>{label}</div><div style={{ ...S.cardValue, color: accent }}>{value}</div><div style={S.cardNote}>{note}</div></div>);
}
function SectionTitle({ children }) { return <h2 style={S.section}>{children}</h2>; }
function ViewNote({ children }) { return <div style={S.viewNote}>{children}</div>; }
function NumField({ label, sub, value, onChange, prefix, step, readOnly }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}{sub && <span style={S.fieldSub}> · {sub}</span>}</span>
      <span style={S.fieldInputWrap}>
        {prefix && <span style={S.fieldPrefix}>{prefix}</span>}
        <input className="cell" type="number" step={step} value={value === undefined || value === null ? "" : value} readOnly={readOnly}
          onChange={(e) => onChange(e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))}
          style={{ ...S.fieldInput, paddingLeft: prefix ? 22 : 12, background: readOnly ? "#F6F9F8" : "#fff" }} />
      </span>
    </label>
  );
}
function Paid({ on, editable, onClick }) {
  if (!editable) return <span style={{ color: on ? T.money : T.muted, fontWeight: 700, fontSize: 13 }}>{on ? "✓ paid" : "—"}</span>;
  return (
    <button onClick={onClick} className="tog" style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: on ? T.money : "#CFD9D8", position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </button>
  );
}
function PublishBar({ onPublish, publishedAt, kind }) {
  return (
    <div style={S.publishBar}>
      <div>
        <div style={S.publishTitle}>Publish {kind} to the group</div>
        <div style={S.publishSub}>
          {publishedAt ? `Last published ${fmtDate(new Date(publishedAt).toISOString().slice(0, 10))}. Re-publish to share the latest.` : "Not published yet. Share a snapshot to your WhatsApp group."}
        </div>
      </div>
      <button className="primaryBtn" style={S.primaryBtn} onClick={onPublish}>📣 Publish &amp; share</button>
    </div>
  );
}

function PublishModal({ kind, text, poster, onDone, onClose }) {
  const [tab, setTab] = useState("image");
  const [copied, setCopied] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  React.useEffect(() => { if (poster) setImgUrl(poster.toDataURL("image/png")); }, [poster]);

  const shareImageNative = async () => { onDone(); const r = await sharePoster(poster, kind + "-bill.png"); if (r === "downloaded") alert("Image downloaded — attach it to your WhatsApp group."); };
  const downloadImage = async () => {
    onDone();
    const blob = await canvasToBlob(poster);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = kind + "-bill.png";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const shareTextApp = () => { onDone(); window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(text), "_blank"); };
  const shareTextWeb = () => { onDone(); window.open("https://web.whatsapp.com/send?text=" + encodeURIComponent(text), "_blank"); };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); onDone(); setTimeout(() => setCopied(false), 1800); } catch {} };

  return (
    <div style={S.drawerBack} onClick={onClose}>
      <div style={S.pubPanel} onClick={(e) => e.stopPropagation()}>
        <div style={S.pubHead}>
          <div style={S.pubTitle}>Publish {kind}</div>
          <button style={S.pubClose} onClick={onClose}>✕</button>
        </div>
        <div style={S.pubTabs}>
          <button onClick={() => setTab("image")} style={{ ...S.pubTab, ...(tab === "image" ? S.pubTabOn : {}) }}>🖼 Image poster</button>
          <button onClick={() => setTab("text")} style={{ ...S.pubTab, ...(tab === "text" ? S.pubTabOn : {}) }}>📝 Text message</button>
        </div>
        {tab === "image" && (<>
          <div style={S.pubHint}>Preview of the poster. Share via WhatsApp or download to attach manually.</div>
          {imgUrl && <img src={imgUrl} alt="poster" style={S.pubImg} />}
          <div style={S.pubFoot}>
            <button style={S.ghostBtn2} onClick={downloadImage}>⬇ Download PNG</button>
            <button className="primaryBtn" style={S.primaryBtn} onClick={shareImageNative}>📤 Share on WhatsApp</button>
          </div>
        </>)}
        {tab === "text" && (<>
          <div style={S.pubHint}>Full-detail text for WhatsApp. Choose App or Web.</div>
          <pre style={S.pubPre}>{text}</pre>
          <div style={S.pubFoot}>
            <button style={S.ghostBtn2} onClick={copy}>{copied ? "✓ Copied" : "📋 Copy"}</button>
            <button style={S.ghostBtn2} onClick={shareTextWeb}>🌐 WhatsApp Web</button>
            <button className="primaryBtn" style={S.primaryBtn} onClick={shareTextApp}>📱 WhatsApp App</button>
          </div>
        </>)}
      </div>
    </div>
  );
}


/* ---- Reusable confirm modal (replaces window.confirm) ---- */
function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}
      onClick={onCancel}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "22px 24px", width: "min(400px, 92vw)", boxShadow: "0 12px 40px rgba(0,0,0,.2)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{title || "Confirm"}</div>
        <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.5, marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: font, color: T.inkSoft }}
            onClick={onCancel}>Cancel</button>
          <button style={{ background: confirmColor || T.owed, border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: font, color: "#fff" }}
            onClick={onConfirm}>{confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

function Drawer({ children, onClose }) {
  return (<div style={S.drawerBack} onClick={onClose}><div style={S.drawer} onClick={(e) => e.stopPropagation()}><button style={S.drawerClose} onClick={onClose}>✕</button>{children}</div></div>);
}

/* ---- Home hub — icon grid with live data summaries ---- */
function HomeHub({ myName, meFlat, admin, mobile, t, waterLabel, maintLabel, myWaterBill, maintPerFlat, activityCount, onNav }) {
  const cards = [
    { key: "water", icon: "💧", label: t("water"), sub: waterLabel || t("current"), value: myWaterBill > 0 ? money(myWaterBill) : t("view"), color: "#4B86E0" },
    { key: "maintenance", icon: "🔧", label: t("maintenance"), sub: maintLabel || t("current"), value: maintPerFlat > 0 ? money(maintPerFlat) : t("view"), color: "#E8883C" },
    { key: "dashboard", icon: "📋", label: t("overview"), sub: t("billsPayments"), value: t("view"), color: "#6B5CE7" },
    ...(meFlat ? [{ key: "flat", icon: "🏠", label: t("myFlat"), sub: `${t("flat")} ${meFlat}`, value: t("view"), color: "#2FA84F" }] : []),
    { key: "community", icon: "📊", label: t("community"), sub: activityCount > 0 ? `${activityCount} ${t("recentActivity")}` : t("pollsUpdates"), value: activityCount > 0 ? `${activityCount} new` : t("view"), color: "#D64B8A" },
    { key: "history", icon: "📜", label: t("history"), sub: t("pastMonths"), value: t("view"), color: "#8A8A9A" },
    ...(admin ? [{ key: "members", icon: "👥", label: t("members"), sub: t("rolesFlats"), value: t("manage"), color: "#B07A0E" }] : []),
  ];

  return (
    <div>
      <div style={H.welcome}>
        <div style={H.welcomeText}>{t("welcome")} <b>{myName}</b></div>
        <div style={H.welcomeSub}>{t("welcomeSub")}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: mobile ? 10 : 14 }}>
        {cards.map((c) => (
          <button key={c.key} onClick={() => onNav(c.key)} style={H.card}>
            <div style={{ fontSize: mobile ? 28 : 34, marginBottom: 6 }}>{c.icon}</div>
            <div style={H.cardLabel}>{c.label}</div>
            <div style={H.cardSub}>{c.sub}</div>
            <div style={{ ...H.cardValue, color: c.color }}>{c.value}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const H = {
  welcome: { marginBottom: 20, textAlign: "center" },
  welcomeText: { fontFamily: display, fontSize: 20, fontWeight: 700, color: T.ink },
  welcomeSub: { fontSize: 14, color: T.inkSoft, marginTop: 4 },
  card: {
    background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16,
    padding: "20px 14px", textAlign: "center", cursor: "pointer",
    transition: "transform .1s, box-shadow .1s", fontFamily: font,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  },
  cardLabel: { fontFamily: display, fontWeight: 700, fontSize: 15, color: T.ink },
  cardSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  cardValue: { fontFamily: mono, fontWeight: 700, fontSize: 16, marginTop: 6 },
};

/* ---- Mobile-specific styles ---- */
const MB = {
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", background: T.water, color: "#fff",
    position: "sticky", top: 0, zIndex: 30,
  },
  hamburger: {
    background: "none", border: "none", color: "#fff", fontSize: 22,
    cursor: "pointer", padding: "4px 8px", lineHeight: 1,
  },
  headerCenter: { flex: 1, textAlign: "center" },
  buildingSelect: {
    fontFamily: display, fontWeight: 700, fontSize: 17, color: "#fff",
    background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)",
    borderRadius: 8, padding: "4px 10px",
    cursor: "pointer", maxWidth: 200, WebkitAppearance: "none", appearance: "none",
    textAlign: "center",
  },
  drawerBack: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
    zIndex: 60, display: "flex",
  },
  drawer: {
    width: "min(300px, 80vw)", height: "100%", background: T.surface,
    boxShadow: "4px 0 20px rgba(0,0,0,.15)", overflowY: "auto",
    display: "flex", flexDirection: "column",
  },
  drawerHeader: {
    padding: "20px 18px 16px", background: T.water, color: "#fff",
    position: "relative",
  },
  drawerName: { fontFamily: display, fontWeight: 700, fontSize: 18 },
  drawerSub: { fontSize: 13, opacity: 0.85, marginTop: 4 },
  drawerClose: {
    position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,.2)",
    border: "none", color: "#fff", width: 28, height: 28, borderRadius: "50%",
    cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
  },
  drawerNav: { padding: "12px 0", flex: 1 },
  drawerItem: {
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    padding: "12px 20px", border: "none", background: "none",
    fontSize: 15, color: T.ink, cursor: "pointer", fontFamily: font,
    textAlign: "left",
  },
  drawerItemActive: { background: T.waterSoft, color: T.water, fontWeight: 700 },
  drawerDivider: { height: 1, background: T.line, margin: "4px 16px" },
  drawerSection: { padding: "12px 20px" },
  dangleBar: {
    display: "flex", justifyContent: "center", paddingTop: 2, paddingBottom: 4,
    background: "linear-gradient(to bottom, rgba(99,102,241,.08), transparent)",
    minHeight: 52,
  },
  bottomNav: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    display: "flex", justifyContent: "space-around", alignItems: "center",
    background: T.surface, borderTop: "1px solid " + T.line,
    padding: "8px 0 max(env(safe-area-inset-bottom, 12px), 12px)",
    zIndex: 30, boxShadow: "0 -2px 10px rgba(0,0,0,.06)",
  },
  bottomNavItem: {
    display: "flex", flexDirection: "column", alignItems: "center",
    border: "none", background: "none", color: T.muted,
    cursor: "pointer", padding: "4px 12px", fontFamily: font, fontWeight: 500,
    minWidth: 56,
  },
  bottomNavItemActive: { color: T.water, fontWeight: 700 },
};
