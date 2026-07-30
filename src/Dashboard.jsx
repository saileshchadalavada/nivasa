import React, { useState, useMemo } from "react";
import { money, money2, labelFromStart, fmtDate } from "./util";
import { buildWaterSnapshot, buildMaintSnapshot } from "./snapshot";
import { generateWaterPoster, generateMaintPoster, sharePoster, canvasToBlob } from "./poster";
import { HISTORY, HISTORY_MONTHS } from "./historicalWater";
import { publishPeriod } from "./data";
import { isAdmin, canEditWater, canEditMaint } from "./seedData";
import Members from "./Members";
import History from "./History";
import MeterScan from "./MeterScan";
import MeterCapture from "./MeterCapture";
import CsvUpload from "./CsvUpload";
import { styles as S, T, css, display, mono, applyTheme } from "./styles";
import { THEME_LIST, getThemeId, setThemeId } from "./theme";

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
  user, membership, config, bid, flats, members,
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
  const canWater = canEditWater(membership, config, uid);
  const canMaint = canEditMaint(membership, config, uid);
  const meFlat = membership.flat;
  const dirty = waterDirty || maintDirty;

  const residential = useMemo(
    () => flats.filter((f) => !f.isCommon).sort((a, b) => a.flat.localeCompare(b.flat)), [flats]);
  const allMeters = useMemo(() => [...residential, ...flats.filter((f) => f.isCommon)], [flats, residential]);
  const nRes = residential.length || 1;

  const [tab, setTab] = useState("dashboard");
  const [openFlat, setOpenFlat] = useState(null);
  const [publish, setPublish] = useState(null);
  const [themeId, _setTheme] = useState(getThemeId());
  const switchTheme = (id) => { setThemeId(id); applyTheme(id); _setTheme(id); document.body.style.background = T.bg; }; // "water" | "maint" | null

  const myName = (meFlat && residential.find((f) => f.flat === meFlat)?.name) || membership.username || "Member";

  // reusable calculators
  const computeWater = (M) => {
    if (!M) return { rows: [], totalCons: 1, rawCons: 0, resCons: 1, genCost: 0, manCost: 0, manEqual: 0, connEqual: 0, grandTotal: 0 };
    const rows = allMeters.map((f) => {
      const r = M.readings?.[f.flat] || { prev: 0, curr: 0, adj: 0 };
      const cons = Math.max(0, (r.curr || 0) - (r.prev || 0));
      return { ...f, prev: r.prev || 0, curr: r.curr, adj: r.adj || 0, cons };
    });
    const rawCons = rows.reduce((s, r) => s + r.cons, 0);
    const totalCons = rawCons || 1;
    // residential-only consumption — the denominator for splitting cost, so the
    // common/watchman meter's usage is shared across paying flats (not dropped).
    const resCons = rows.filter((r) => !r.isCommon).reduce((s, r) => s + r.cons, 0) || 1;
    const genCost = (M.genCount || 0) * (M.genRate || 0);
    const manCost = (M.manCount || 0) * (M.manRate || 0);
    const manEqual = manCost / nRes, connEqual = (M.connBill || 0) / nRes;
    const detailed = rows.map((r) => {
      const pct = (r.cons / totalCons) * 100; // usage share of the whole building (incl. common) — sums to 100
      const genShare = (r.cons / totalCons) * genCost; // split by % of total building use (incl. common) — matches the Excel register
      return { ...r, pct, genShare, manEqual: r.isCommon ? 0 : manEqual, connEqual: r.isCommon ? 0 : connEqual,
        bill: r.isCommon ? 0 : genShare + manEqual + connEqual + (r.adj || 0) };
    });
    return { rows: detailed, totalCons, rawCons, resCons, genCost, manCost, manEqual, connEqual, grandTotal: genCost + manCost + (M.connBill || 0) };
  };
  const computeMaint = (M) => {
    const exp = (M && M.expenses) || [];
    const total = exp.reduce((s, e) => s + Number(e.amount || 0), 0);
    const byMember = {};
    exp.forEach((e) => { if (e.paidBy && e.paidBy !== "fund") byMember[e.paidBy] = (byMember[e.paidBy] || 0) + Number(e.amount || 0); });
    return { total, perFlat: total / nRes, byMember };
  };

  // edited period (Water/Maintenance tabs)
  const water = useMemo(() => computeWater(waterMonth), [waterMonth, allMeters, nRes]);
  const maint = useMemo(() => computeMaint(maintMonth), [maintMonth, nRes]);
  // current bill (Overview + header)
  const dispWater = useMemo(() => computeWater(displayWater), [displayWater, allMeters, nRes]);
  const dispMaint = useMemo(() => computeMaint(displayMaint), [displayMaint, nRes]);

  const waterStart = waterMonth.periodStart || "", waterEnd = waterMonth.periodEnd || "";
  const maintStart = maintMonth.periodStart || "", maintEnd = maintMonth.periodEnd || "";
  const startReadyWater = !!waterStart && !!waterEnd && !waterDirty && water.grandTotal > 0 && water.rawCons > 0;
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
    // try real closed periods first
    const prev = [...pastWater].filter((p) => p.periodEnd).sort((a, b) => (a.periodEnd || "").localeCompare(b.periodEnd || "")).pop();
    if (prev) {
      const map = {};
      Object.entries(prev.readings || {}).forEach(([flat, r]) => { map[flat] = Math.max(0, (r.curr || 0) - (r.prev || 0)); });
      return map;
    }
    // fallback: baked-in history (if available) — find the month just before the current period
    const curStart = waterMonth.periodStart || "";
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
    try { await publishPeriod(bid, coll, id, uid); } catch {}
  };
  const wCosts = { genCount: Number(waterMonth.genCount)||0, genRate: Number(waterMonth.genRate)||0, manCount: Number(waterMonth.manCount)||0, manRate: Number(waterMonth.manRate)||0, connBill: Number(waterMonth.connBill)||0 };
  const snapshotText = (kind) => kind === "water"
    ? buildWaterSnapshot({ name: config.name, label: labelFromStart(waterStart) || "Water", start: fmtDate(waterStart), end: fmtDate(waterEnd), rows: water.rows, prevCons: prevWaterCons, grandTotal: water.grandTotal, ...wCosts })
    : buildMaintSnapshot({ name: config.name, label: labelFromStart(maintStart) || "Maintenance", start: fmtDate(maintStart), end: fmtDate(maintEnd), expenses: maintMonth.expenses || [], total: maint.total, perFlat: maint.perFlat, byMember: maint.byMember });

  const snapshotPoster = (kind) => kind === "water"
    ? generateWaterPoster({ name: config.name, label: labelFromStart(waterStart) || "Water", start: fmtDate(waterStart), end: fmtDate(waterEnd), rows: water.rows, prevCons: prevWaterCons, grandTotal: water.grandTotal, ...wCosts })
    : generateMaintPoster({ name: config.name, label: labelFromStart(maintStart) || "Maintenance", start: fmtDate(maintStart), end: fmtDate(maintEnd), expenses: maintMonth.expenses || [], total: maint.total, perFlat: maint.perFlat, byMember: maint.byMember });

  const shareInvite = async () => {
    const link = `${window.location.origin}${window.location.pathname}?b=${bid}&join=${config.inviteCode}`;
    const text = `Join our ${config.name} ledger on Nivasa: ${link} (invite code ${config.inviteCode})`;
    try { await navigator.clipboard.writeText(link); } catch {}
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const tabs = [
    ["dashboard", "Overview"], ["water", "Water"], ["maintenance", "Maintenance"],
    ...(meFlat ? [["flat", "My flat"]] : []), ["history", "History"],
    ...(admin ? [["members", "Members"]] : []),
  ];

  return (
    <div style={S.app}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <header style={{ ...S.header, ...(mobile ? { padding: "14px 16px", gap: 8 } : {}) }}>
        <div style={S.headLeft}>
          {!mobile && <div style={{ ...S.mark, background: T.brandDark }}>
            {[5,4,3,2,1].map((fl) => (<div key={fl} style={S.markRow}>{[0,1,2].map((c) => <span key={c} style={S.markDot} />)}</div>))}
          </div>}
          <div>
            <div style={S.brandRow}>
              <select value={bid} style={{ ...S.switcher, ...(mobile ? { fontSize: 15, maxWidth: 160 } : {}) }}
                onChange={(e) => onSwitch(e.target.value)}>
                {(buildings || []).map((b) => <option key={b.bid} value={b.bid} style={{ color: T.ink, background: "#fff" }}>{b.name}</option>)}
              </select>
              <button style={S.newBldBtn} onClick={onNewBuilding} title="Create or join another building">＋</button>
            </div>
            {!mobile && <div style={S.brandSub}>{[config.city, config.state].filter(Boolean).join(", ") || "Shared ledger"} · {nRes} flats</div>}
          </div>
        </div>
        <div style={{ ...S.headRight, ...(mobile ? { gap: 8 } : {}) }}>
          {!mobile && (isWaterTab ? (
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
          ))}
          <div style={S.userBox}>
            <div style={{ ...S.avatar, ...(mobile ? { width: 32, height: 32, fontSize: 12 } : {}) }}>{initialsOf(myName)}</div>
            <div style={S.userMeta}>
              <div style={{ ...S.userName, ...(mobile ? { fontSize: 13 } : {}) }}>{myName}</div>
              {!mobile && <div style={S.userSub}>{roleText(membership, admin, meFlat)}</div>}
              {!mobile && <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {THEME_LIST.map((t) => (
                  <button key={t.id} onClick={() => switchTheme(t.id)} title={t.name}
                    style={{ width: 22, height: 22, borderRadius: "50%", border: themeId === t.id ? "2px solid #fff" : "2px solid transparent",
                      background: t.color, cursor: "pointer", fontSize: 10, padding: 0 }} />
                ))}
              </div>}
              <button style={S.signout} onClick={onSignOut}>Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <nav style={{ ...S.tabs, ...(mobile ? { padding: "0 12px", gap: 0 } : {}) }}>
        {tabs.map(([k, l]) => (<button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}), ...(mobile ? { padding: "11px 10px", fontSize: 12.5 } : {}) }}>{l}</button>))}
      </nav>

      <main style={{ ...S.main, ...(mobile ? { padding: "16px 12px" } : {}) }}>
        {tab === "dashboard" && (
          <Overview water={dispWater} maint={dispMaint} paidWater={displayWater?.paidWater || {}} paidMaint={displayMaint?.paidMaint || {}}
            waterPeriod={dw} maintPeriod={dm}
            residential={residential} canWater={canWater} canMaint={canMaint} admin={admin} config={config}
            togglePaidWater={togglePaidWater} togglePaidMaint={togglePaidMaint} openFlat={setOpenFlat} onShare={shareInvite} mobile={mobile} />
        )}
        {tab === "water" && (
          <WaterEntry water={water} setField={setWaterField} setReading={setReading} canEdit={canWater}
            periodStart={waterStart} periodEnd={waterEnd}
            costs={{ genCount: waterMonth.genCount, genRate: waterMonth.genRate, manCount: waterMonth.manCount, manRate: waterMonth.manRate, connBill: waterMonth.connBill }}
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
            startReady={startReadyMaint} saving={saving} mobile={mobile} />
        )}
        {tab === "flat" && <FlatStatement flat={meFlat} water={water} maint={maint} residential={residential} />}
        {tab === "history" && <History flat={meFlat} residential={residential} pastWater={pastWater} pastMaint={pastMaint} canPickAny={admin || canWater || canMaint} showSeedHistory={!!config.seededSrGold} />}
        {tab === "members" && admin && <Members bid={bid} members={members} flats={flats} config={config} onDeleteBuilding={onDeleteBuilding} onImportWater2026={onImportWater2026} canImportWater2026={canImportWater2026} mobile={mobile} />}
      </main>

      {openFlat && (
        <Drawer onClose={() => setOpenFlat(null)}>
          <FlatStatement flat={openFlat} water={water} maint={maint} residential={residential} embedded />
        </Drawer>
      )}

      {publish && (
        <PublishModal kind={publish} text={snapshotText(publish)} poster={snapshotPoster(publish)}
          onDone={() => doPublish(publish)} onClose={() => setPublish(null)} />
      )}

      {(canWater || canMaint) && dirty && ["dashboard", "water", "maintenance"].includes(tab) && (
        <div style={S.saveBar}>
          <div style={S.saveBarInner}>
            <span>Unsaved changes — residents see them once you save.</span>
            <span style={{ display: "flex", gap: 10 }}>
              <button className="ghostBtn" style={S.ghostBtn} onClick={onDiscard} disabled={saving}>Undo</button>
              <button className="primaryBtn" style={S.primaryBtn} onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </span>
          </div>
        </div>
      )}
      {!dirty && <footer style={S.footer}>Everyone sees updates the moment an editor saves.</footer>}
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
function Overview({ water, maint, paidWater, paidMaint, waterPeriod, maintPeriod, residential, canWater, canMaint, admin, config, togglePaidWater, togglePaidMaint, openFlat, onShare, mobile }) {
  const billable = water.rows.filter((r) => !r.isCommon).reduce((s, r) => s + r.bill, 0) + maint.total;
  const collected = residential.reduce((s, f) => {
    const w = paidWater[f.flat] ? (water.rows.find((r) => r.flat === f.flat)?.bill || 0) : 0;
    const m = paidMaint[f.flat] ? maint.perFlat : 0;
    return s + w + m;
  }, 0);
  const statusOf = (flat) => {
    const w = !!paidWater[flat], m = !!paidMaint[flat];
    return w && m ? "paid" : (!w && !m ? "unpaid" : "partial");
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
        <Card label="Water this period" value={money(water.grandTotal)} tone="water" note="tankers + Manjeera + connection" />
        <Card label="Maintenance this period" value={money(maint.total)} tone="ink" note={`${money(maint.perFlat)} per flat`} />
        <Card label="Total billable" value={money(billable)} tone="ink" note={`water + maintenance, ${residential.length} flats`} />
        <Card label="Collected" value={money(collected)} tone="money" note={`${Math.round((collected / (billable || 1)) * 100)}% of billable`} />
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
      {mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {residential.map((f) => {
            const w = water.rows.find((r) => r.flat === f.flat)?.bill || 0;
            const owed = maint.byMember[f.flat] || 0;
            const netDue = w + maint.perFlat - owed;
            return (
              <div key={f.flat} onClick={() => openFlat(f.flat)}
                style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16 }}>{f.flat}</span>
                    <span style={{ fontSize: 13, color: T.inkSoft, marginLeft: 8 }}>{f.name || ""}</span>
                  </div>
                  <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: netDue < 0 ? T.money : T.ink }}>
                    {netDue < 0 ? `+${money(Math.abs(netDue))}` : money(netDue)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.inkSoft, marginBottom: 8 }}>
                  <span>Water: <b style={{ color: T.ink }}>{money(w)}</b></span>
                  <span>Maint: <b style={{ color: T.ink }}>{money(maint.perFlat)}</b>{owed > 0 && <span style={{ color: T.owed }}> −{money(owed)}</span>}</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    💧 <Paid on={!!paidWater[f.flat]} editable={canWater} onClick={(e) => { e.stopPropagation(); togglePaidWater(f.flat); }} />
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    🔧 <Paid on={!!paidMaint[f.flat]} editable={canMaint} onClick={(e) => { e.stopPropagation(); togglePaidMaint(f.flat); }} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Flat</th><th style={S.th}>Name</th>
            <th style={{ ...S.th, textAlign: "right" }}>Water</th>
            <th style={{ ...S.th, textAlign: "right" }}>Maint.</th>
            <th style={{ ...S.th, textAlign: "right" }}>Total due</th>
            <th style={{ ...S.th, textAlign: "center" }}>Water</th>
            <th style={{ ...S.th, textAlign: "center" }}>Maint</th>
          </tr></thead>
          <tbody>
            {residential.map((f) => {
              const w = water.rows.find((r) => r.flat === f.flat)?.bill || 0;
              const owed = maint.byMember[f.flat] || 0;
              const netDue = w + maint.perFlat - owed;
              return (
                <tr key={f.flat} className="row" onClick={() => openFlat(f.flat)}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{f.flat}</td>
                  <td style={S.td}>{f.name || "—"}</td>
                  <td style={{ ...S.td, ...S.num }}>{money(w)}</td>
                  <td style={{ ...S.td, ...S.num }}>{money(maint.perFlat)}{owed > 0 && <span style={{ color: T.owed, fontSize: 11 }}> −{money(owed)}</span>}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700, color: netDue < 0 ? T.money : T.ink }}>{netDue < 0 ? `+${money(Math.abs(netDue))}` : money(netDue)}</td>
                  <td style={{ ...S.td, textAlign: "center" }}><Paid on={!!paidWater[f.flat]} editable={canWater} onClick={(e) => { e.stopPropagation(); togglePaidWater(f.flat); }} /></td>
                  <td style={{ ...S.td, textAlign: "center" }}><Paid on={!!paidMaint[f.flat]} editable={canMaint} onClick={(e) => { e.stopPropagation(); togglePaidMaint(f.flat); }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

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
function WaterEntry({ water, setField, setReading, canEdit, periodStart, periodEnd, costs, onSetMeter, onBackfill, showAdj, onToggleAdj, periods, selId, onSelect, isLatest, onPublish, publishedAt, onStartNext, onDeletePeriod, canDelete, startReady, saving, flats, mobile }) {
  const anyAdj = water.rows.some((r) => r.adj);
  const adjOn = showAdj || anyAdj;
  const [showScan, setShowScan] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [capFlat, setCapFlat] = useState(null); // {flat, meter} being captured
  return (
    <>
      {capFlat && (
        <MeterCapture flat={capFlat.flat} expectedMeter={capFlat.meter}
          onApply={(val) => setReading(capFlat.flat, "curr", String(val))}
          onClose={() => setCapFlat(null)} />
      )}
      {showScan && (
        <MeterScan meters={water.rows.map((r) => ({ flat: r.flat, meter: r.meter }))}
          onApply={(map) => Object.entries(map).forEach(([flat, val]) => setReading(flat, "curr", String(val)))}
          onClose={() => setShowScan(false)} />
      )}
      {showCsv && (
        <CsvUpload existingFlats={flats}
          onApply={(map) => Object.entries(map).forEach(([flat, val]) => setReading(flat, "curr", String(val)))}
          onClose={() => setShowCsv(false)} />
      )}
      {!canEdit && <ViewNote>You have view access. Ask the water in-charge or admin to make changes.</ViewNote>}
      <PeriodControls kind="water" periodStart={periodStart} periodEnd={periodEnd} setField={setField} onBackfill={onBackfill}
        periods={periods} selId={selId} onSelect={onSelect} isLatest={isLatest}
        canEdit={canEdit} onStartNext={onStartNext} onDeletePeriod={onDeletePeriod} canDelete={canDelete} startReady={startReady} saving={saving} />

      <SectionTitle>This period's water costs</SectionTitle>
      <div style={S.inputGrid}>
        <NumField label="General tankers" sub="split by meter %" value={costs.genCount} onChange={(v) => setField("genCount", v)} readOnly={!canEdit} />
        <NumField label="General rate / tanker" prefix="₹" value={costs.genRate} onChange={(v) => setField("genRate", v)} readOnly={!canEdit} />
        <NumField label="Manjeera tankers" sub="split equally" value={costs.manCount} onChange={(v) => setField("manCount", v)} readOnly={!canEdit} />
        <NumField label="Manjeera rate / tanker" prefix="₹" value={costs.manRate} onChange={(v) => setField("manRate", v)} readOnly={!canEdit} />
        <NumField label="Manjeera connection (HMWSSB)" sub="split equally" prefix="₹" step="0.01" value={costs.connBill} onChange={(v) => setField("connBill", v)} readOnly={!canEdit} />
      </div>
      <div style={S.costStrip}>
        <span>General <b style={S.num}>{money(water.genCost)}</b></span><span style={S.plus}>+</span>
        <span>Manjeera tankers <b style={S.num}>{money(water.manCost)}</b></span><span style={S.plus}>+</span>
        <span>Connection <b style={S.num}>{money2(costs.connBill || 0)}</b></span><span style={S.plus}>=</span>
        <span style={S.costTotal}>{money(water.grandTotal)}</span>
      </div>

      <div style={{ ...S.periodHead, ...(mobile ? { flexDirection: "column", alignItems: "stretch", gap: 8 } : {}) }}>
        <SectionTitle>Meter readings</SectionTitle>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {canEdit && !mobile && <label style={{ fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={adjOn} disabled={anyAdj} onChange={onToggleAdj} title={anyAdj ? "Shown because an adjustment is set" : "Show the per-flat adjustment column"} /> Adjustment column
          </label>}
          {canEdit && <button className="add" style={{ ...S.addBtn, ...(mobile ? { marginTop: 0, padding: "8px 12px", fontSize: 12.5 } : {}) }} onClick={() => setShowCsv(true)}>📄 Upload CSV</button>}
          {canEdit && <button className="add" style={{ ...S.addBtn, ...(mobile ? { marginTop: 0, padding: "8px 12px", fontSize: 12.5 } : {}) }} onClick={() => setShowScan(true)}>📷 Scan</button>}
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
                <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: r.isCommon ? T.muted : T.ink }}>{r.isCommon ? "—" : money(r.bill)}</span>
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
                      <button title="Camera" onClick={() => setCapFlat({ flat: r.flat, meter: r.meter })}
                        style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 7, width: 34, height: 34, cursor: "pointer", fontSize: 15, flexShrink: 0 }}>📷</button>
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
            <span style={{ fontFamily: mono }}>{money(water.rows.filter((r) => !r.isCommon).reduce((s, r) => s + r.bill, 0))}</span>
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
                      <button title="Capture with camera" onClick={() => setCapFlat({ flat: r.flat, meter: r.meter })}
                        style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 7, width: 30, height: 30, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>📷</button>
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
                <td style={{ ...S.td, ...S.num, fontWeight: 700, color: r.isCommon ? T.muted : T.ink }}>{r.isCommon ? "—" : money(r.bill)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td style={S.tfoot} colSpan={4}>Totals</td>
            <td style={{ ...S.tfoot, ...S.num }}>{water.totalCons.toFixed(1)}</td>
            <td style={{ ...S.tfoot, ...S.num }}>100.00</td>
            {adjOn && <td style={S.tfoot}></td>}
            <td style={{ ...S.tfoot, ...S.num }}>{money(water.rows.filter((r) => !r.isCommon).reduce((s, r) => s + r.bill, 0))}</td>
          </tr></tfoot>
        </table>
        </div>
      )}
      <p style={S.note}>Common/Watchman counts toward the general-tanker % but carries no Manjeera or connection share. The Previous (opening) reading carries from last period but is editable — override it if a meter was reset or replaced.</p>
      {canEdit && <PublishBar onPublish={onPublish} publishedAt={publishedAt} kind="water" />}
      <PeriodBanner kind="Water" periodStart={periodStart} periodEnd={periodEnd} />
    </>
  );
}

/* ============================ MAINTENANCE ============================ */
function Maintenance({ maint, expenses, setExpenses, residential, canEdit, setField, periodStart, periodEnd, onBackfill, periods, selId, onSelect, isLatest, onPublish, publishedAt, onStartNext, onDeletePeriod, canDelete, startReady, saving, mobile }) {
  const update = (id, key, val) => setExpenses((xs) => xs.map((e) => e.id === id ? { ...e, [key]: val } : e));
  const remove = (id) => setExpenses((xs) => xs.filter((e) => e.id !== id));
  const add = () => setExpenses((xs) => [...xs, { id: "e" + Date.now(), item: "", amount: 0, paidBy: "fund" }]);

  return (
    <>
      {!canEdit && <ViewNote>You have view access. Ask the treasurer or admin to make changes.</ViewNote>}
      <PeriodControls kind="maintenance" periodStart={periodStart} periodEnd={periodEnd} setField={setField} onBackfill={onBackfill}
        periods={periods} selId={selId} onSelect={onSelect} isLatest={isLatest}
        canEdit={canEdit} onStartNext={onStartNext} onDeletePeriod={onDeletePeriod} canDelete={canDelete} startReady={startReady} saving={saving} />

      <div style={S.cards}>
        <Card label="Total spent" value={money(maint.total)} tone="ink" note={`${expenses.length} line items`} />
        <Card label="Per flat" value={money(maint.perFlat)} tone="water" note={`total ÷ ${residential.length} flats`} />
        <Card label="Owed to members" value={money(Object.values(maint.byMember).reduce((s, n) => s + n, 0))} tone="owed" note="adhoc expenses fronted" />
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
      {canEdit && <PublishBar onPublish={onPublish} publishedAt={publishedAt} kind="maintenance" />}
      <PeriodBanner kind="Maintenance" periodStart={periodStart} periodEnd={periodEnd} />
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
function FlatStatement({ flat, water, maint, residential, embedded }) {
  const w = water.rows.find((r) => r.flat === flat);
  const f = residential.find((x) => x.flat === flat);
  if (!w || !f) return <div style={{ color: T.muted }}>No statement for this flat yet.</div>;
  const total = w.bill + maint.perFlat;
  const owedBack = maint.byMember[flat] || 0;
  const net = total - owedBack; // net position after crediting any fronted expenses
  const Line = ({ label, val, sub, strong }) => (
    <div style={{ ...S.stLine, ...(strong ? S.stLineStrong : {}) }}>
      <div><div>{label}</div>{sub && <div style={S.stSub}>{sub}</div>}</div>
      <div style={{ ...S.num, fontWeight: strong ? 700 : 500 }}>{money(val)}</div>
    </div>
  );
  return (
    <div style={embedded ? {} : S.stWrap}>
      <div style={S.stHead}>
        <div><div style={S.stFlat}>Flat {flat}</div><div style={S.stName}>{f.name || "—"}</div></div>
        <div style={S.stTotalBox}><div style={S.stTotalLabel}>{net < 0 ? "Owed to you" : "Total due"}</div><div style={S.stTotal}>{money(Math.abs(net))}</div></div>
      </div>
      <div style={S.stGroup}>Water — {money(w.bill)}</div>
      <Line label="General tankers" sub={`${w.pct.toFixed(2)}% of building use`} val={w.genShare} />
      <Line label="Manjeera tankers" sub="equal share" val={w.manEqual} />
      <Line label="Manjeera connection" sub="equal share" val={w.connEqual} />
      {w.adj !== 0 && <Line label="Adjustment" val={w.adj} />}
      <div style={S.stGroup}>Maintenance — {money(maint.perFlat)}</div>
      <Line label="Common maintenance" sub={`${money(maint.total)} total ÷ ${residential.length}`} val={maint.perFlat} />
      <Line label="Subtotal" val={total} />
      {owedBack > 0 && <Line label="Less: expenses you fronted" sub="reimbursed from the fund" val={-owedBack} />}
      <Line label={net < 0 ? "Net — owed back to you" : "Net payable"} val={Math.abs(net)} strong />
      {owedBack > 0 && <div style={S.stOwed}>You fronted <b>{money(owedBack)}</b> in adhoc expenses. {net < 0 ? `After your ${money(total)} share, the fund owes you ${money(Math.abs(net))}.` : `It's credited against your ${money(total)} share.`}</div>}
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

function Drawer({ children, onClose }) {
  return (<div style={S.drawerBack} onClick={onClose}><div style={S.drawer} onClick={(e) => e.stopPropagation()}><button style={S.drawerClose} onClick={onClose}>✕</button>{children}</div></div>);
}
