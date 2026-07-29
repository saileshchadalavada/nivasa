import React, { useState, useMemo } from "react";
import { HISTORY, HISTORY_LABELS } from "./historicalWater";
import { money, labelFromStart } from "./util";
import { styles as S, T, display, mono } from "./styles";

/* Per-flat historical water. Merges the static tracking sheet with any billing
   periods that have been closed inside the app. Admins / water / treasurer can
   view any flat; residents see their own. */
export default function History({ flat, residential, pastWater = [], pastMaint = [], canPickAny, showSeedHistory }) {
  const [pickFlat, setPickFlat] = useState(flat || (residential[0] && residential[0].flat) || "");
  const F = canPickAny ? pickFlat : (flat || pickFlat);
  const nRes = residential.length || 1;

  // water figures per closed water period
  const waterClosed = useMemo(() => pastWater.map((p) => {
    const start = p.periodStart || "";
    const rows = Object.entries(p.readings || {});
    const flatSet = new Set(residential.map((f) => f.flat));
    const consOf = (r) => Math.max(0, (r.curr || 0) - (r.prev || 0));
    const totalCons = rows.reduce((s, [, r]) => s + consOf(r), 0) || 1;
    const resCons = rows.reduce((s, [flat, r]) => s + (flatSet.has(flat) ? consOf(r) : 0), 0) || 1;
    const genCost = (p.genCount || 0) * (p.genRate || 0);
    const manEqual = ((p.manCount || 0) * (p.manRate || 0)) / nRes;
    const connEqual = (p.connBill || 0) / nRes;
    const flatsData = {};
    residential.forEach((f) => {
      const r = p.readings?.[f.flat] || {};
      const cons = consOf(r);
      flatsData[f.flat] = { l: cons, a: Math.round((cons / resCons) * genCost + manEqual + connEqual + (r.adj || 0)) };
    });
    return { key: start.slice(0, 7), label: labelFromStart(start), flats: flatsData };
  }), [pastWater, residential, nRes]);

  // maintenance per closed maintenance period (equal split)
  const maintClosed = useMemo(() => pastMaint.map((p) => {
    const total = (p.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    return { key: (p.periodStart || "").slice(0, 7), label: labelFromStart(p.periodStart), maint: Math.round(total / nRes) };
  }), [pastMaint, nRes]);

  // merge static sheet + closed water + closed maintenance, keyed by month
  const { months, labels, data } = useMemo(() => {
    const d = {};
    if (showSeedHistory) {
      Object.entries(HISTORY).forEach(([k, v]) => { d[k] = { label: HISTORY_LABELS[k], flats: v, maint: null }; });
    }
    waterClosed.forEach((c) => { if (c.key) d[c.key] = { ...(d[c.key] || { maint: null }), label: c.label, flats: c.flats }; });
    maintClosed.forEach((c) => { if (c.key) d[c.key] = { ...(d[c.key] || { flats: {} }), label: c.label, maint: c.maint }; });
    const keys = Object.keys(d).sort();
    const lab = {}; keys.forEach((k) => (lab[k] = d[k].label));
    return { months: keys, labels: lab, data: d };
  }, [waterClosed, maintClosed, showSeedHistory]);

  const [sel, setSel] = useState(null);
  const selKey = sel && months.includes(sel) ? sel : (months[months.length - 1] || "");

  const series = useMemo(() => months.map((m) => {
    const rec = data[m]?.flats?.[F] || {};
    const total = Object.values(data[m]?.flats || {}).reduce((s, v) => s + (v.l || 0), 0);
    return { m, label: labels[m], litres: rec.l ?? null, amount: rec.a ?? null,
      maint: data[m]?.maint ?? null, buildingLitres: total };
  }), [months, data, labels, F]);

  // no history yet (no seed + no closed periods) — show a friendly empty state
  if (!months.length) {
    return (
      <>
        {canPickAny && (
          <div style={{ marginBottom: 14 }}>
            <label style={H.lbl}>Flat</label>
            <select value={pickFlat} onChange={(e) => setPickFlat(e.target.value)} style={H.sel}>
              {residential.map((f) => <option key={f.flat} value={f.flat} style={{ color: T.ink, background: "#fff" }}>Flat {f.flat} — {f.name || "—"}</option>)}
            </select>
          </div>
        )}
        <p style={S.note}>No history yet for this building. When a billing period is closed with "Start next period", it moves here and you'll be able to look back at past months.</p>
      </>
    );
  }

  const idx = series.findIndex((s) => s.m === selKey);
  const cur = series[idx] || {};
  const prev = series[idx - 1];
  const litreVals = series.filter((s) => s.litres != null).map((s) => s.litres);
  const avgLitres = litreVals.reduce((a, b) => a + b, 0) / (litreVals.length || 1);
  const amtVals = series.filter((s) => s.amount != null).map((s) => s.amount);
  const avgAmt = amtVals.reduce((a, b) => a + b, 0) / (amtVals.length || 1);
  const share = cur.buildingLitres ? (cur.litres || 0) / cur.buildingLitres : 0;

  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  const selYear = selKey.slice(0, 4);
  const monthsInYear = months.filter((m) => m.startsWith(selYear));

  const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);
  const dLast = prev && prev.litres != null && cur.litres != null ? pct(cur.litres, prev.litres) : null;
  const dAvg = cur.litres != null ? pct(cur.litres, avgLitres) : null;
  const maxL = Math.max(...litreVals, 1);

  // total paid = water + maintenance, when we have the figures
  let totalPaid = null, totalNote = "—";
  if (cur.amount != null && cur.maint != null) { totalPaid = cur.amount + cur.maint; totalNote = "water + maintenance"; }
  else if (cur.amount != null) { totalPaid = cur.amount; totalNote = "water only — maintenance not recorded"; }
  else if (cur.maint != null) { totalPaid = cur.maint; totalNote = "maintenance only"; }

  return (
    <>
      {canPickAny && (
        <div style={{ marginBottom: 14 }}>
          <label style={H.lbl}>Flat</label>
          <select value={pickFlat} onChange={(e) => setPickFlat(e.target.value)} style={H.sel}>
            {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} — {f.name || "—"}</option>)}
          </select>
        </div>
      )}

      <div style={H.pickRow}>
        <div>
          <label style={H.lbl}>Year</label>
          <select value={selYear} style={H.sel}
            onChange={(e) => { const first = months.find((m) => m.startsWith(e.target.value)); setSel(first); }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={H.lbl}>Month</label>
          <select value={selKey} onChange={(e) => setSel(e.target.value)} style={H.sel}>
            {monthsInYear.map((m) => <option key={m} value={m}>{labels[m]}</option>)}
          </select>
        </div>
      </div>

      <div style={S.cards}>
        <Card label={`Water used · ${cur.label || ""}`} value={cur.litres != null ? `${(cur.litres / 1000).toFixed(1)} kL` : "—"}
          note={cur.litres != null ? `${Math.round(cur.litres).toLocaleString("en-IN")} litres` : "no reading"} tone="water" />
        <Card label="Water bill" value={cur.amount != null ? money(cur.amount) : "—"}
          note={cur.amount != null ? "share of tanker cost" : "no data available for now"} tone="ink" />
        <Card label="Maintenance paid" value={cur.maint != null ? money(cur.maint) : "—"}
          note={cur.maint != null ? "your equal share" : "no data available for now"} tone="ink" />
        <Card label="Total paid" value={totalPaid == null ? "—" : money(totalPaid)}
          note={totalNote} tone="money" />
        <Card label="Usage vs last month" value={dLast == null ? "—" : `${dLast >= 0 ? "▲" : "▼"} ${Math.abs(dLast).toFixed(0)}%`}
          note={prev ? `${prev.label}: ${prev.litres != null ? (prev.litres / 1000).toFixed(1) + " kL" : "—"}` : "no prior month"}
          tone={dLast == null ? "ink" : dLast > 0 ? "owed" : "money"} />
        <Card label="Usage vs your average" value={dAvg == null ? "—" : `${dAvg >= 0 ? "▲" : "▼"} ${Math.abs(dAvg).toFixed(0)}%`}
          note={`avg ${(avgLitres / 1000).toFixed(1)} kL · ${money(avgAmt)}`}
          tone={dAvg == null ? "ink" : dAvg > 0 ? "owed" : "money"} />
      </div>

      <div style={H.two}>
        <div style={H.panel}>
          <div style={H.panelTitle}>Your share of the building · {cur.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Donut share={share} />
            <div>
              <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 600, color: T.water }}>{(share * 100).toFixed(1)}%</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
                You: {((cur.litres || 0) / 1000).toFixed(1)} kL<br />
                Rest of building: {(((cur.buildingLitres || 0) - (cur.litres || 0)) / 1000).toFixed(1)} kL
              </div>
            </div>
          </div>
        </div>

        <div style={H.panel}>
          <div style={H.panelTitle}>Litres used — tap a bar to jump to that month</div>
          <div style={H.bars}>
            {series.map((s) => (
              <button key={s.m} title={`${s.label}: ${s.litres != null ? Math.round(s.litres).toLocaleString("en-IN") + " L" : "—"}`}
                onClick={() => setSel(s.m)} style={{ ...H.barCol, cursor: "pointer" }}>
                <div style={{ ...H.bar,
                  height: `${s.litres != null ? Math.max(4, (s.litres / maxL) * 100) : 2}%`,
                  background: s.m === selKey ? T.water : (s.litres == null ? "#D8D8E6" : "#B9B5EA") }} />
              </button>
            ))}
          </div>
          <div style={H.barAxis}>
            <span>{series[0]?.label}</span><span>{series[series.length - 1]?.label}</span>
          </div>
        </div>
      </div>

      <p style={S.note}>History covers your tracking sheet (Apr 2023 – Jun 2026) plus any billing periods closed in the app. The ongoing period is on the Water tab.</p>
    </>
  );
}

function Donut({ share }) {
  const r = 42, C = 2 * Math.PI * r, s = Math.max(0, Math.min(1, share));
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx="52" cy="52" r={r} fill="none" stroke="#E7E7F2" strokeWidth="16" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={T.water} strokeWidth="16"
        strokeDasharray={`${s * C} ${C}`} strokeLinecap="round" transform="rotate(-90 52 52)" />
    </svg>
  );
}
function Card({ label, value, note, tone }) {
  const accent = tone === "water" ? T.water : tone === "money" ? T.money : tone === "owed" ? T.owed : T.ink;
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      <div style={{ ...S.cardValue, color: accent, fontSize: 24 }}>{value}</div>
      <div style={S.cardNote}>{note}</div>
    </div>
  );
}

const H = {
  pickRow: { display: "flex", gap: 12, marginBottom: 6 },
  lbl: { display: "block", fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 },
  sel: { padding: "9px 12px", border: `1px solid ${T.line}`, borderRadius: 9, fontSize: 14,
    background: "#fff", color: T.ink, fontFamily: display, fontWeight: 600, minWidth: 120 },
  two: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 6 },
  panel: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 },
  panelTitle: { fontFamily: display, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 },
  bars: { display: "flex", alignItems: "flex-end", gap: 3, height: 120 },
  barCol: { flex: 1, height: "100%", display: "flex", alignItems: "flex-end", background: "none", border: "none", padding: 0 },
  bar: { width: "100%", borderRadius: "3px 3px 0 0", transition: "background .1s", minHeight: 2 },
  barAxis: { display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 8 },
};
