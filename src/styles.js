import { getThemeId, getTheme } from "./theme";

// T is a mutable theme token object. applyTheme() swaps its values at runtime.
const _init = getTheme(getThemeId());
export const T = { ..._init };

export function applyTheme(id) {
  const t = getTheme(id);
  Object.keys(t).forEach((k) => { T[k] = t[k]; });
}

const font = "'Inter', system-ui, sans-serif";
const display = "'Poppins', system-ui, sans-serif";
const mono = "'Spline Sans Mono', monospace";
export { font, display, mono };

export const css = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=Spline+Sans+Mono:wght@500;600&display=swap');
* { box-sizing: border-box; }
body { margin: 0; -webkit-font-smoothing: antialiased; }
.row { cursor: pointer; transition: background .12s; }
.row:hover { background: rgba(75,63,192,.06) !important; }
.cell { font-family: 'Spline Sans Mono', monospace; }
.cell:focus { outline: 2px solid rgba(75,63,192,.5); outline-offset: -1px; }
.tog:focus-visible { outline: 2px solid ${T.water}; outline-offset: 2px; }
.del { opacity: .5; transition: opacity .12s; }
.del:hover { opacity: 1; }
.add:hover { background: ${T.water}; color: #fff; }
.primaryBtn:hover { filter: brightness(1.07); }
.primaryBtn:disabled { opacity: .55; cursor: not-allowed; }
.tile { transition: transform .08s, filter .08s; }
.tile:hover:not(:disabled) { filter: brightness(1.04); }
.tile:active:not(:disabled) { transform: translateY(1px); }
`;

const card = { background: T.surface, borderRadius: 14, border: `1px solid ${T.line}` };

export const styles = {
  app: { fontFamily: font, background: T.bg, minHeight: "100vh", color: T.ink,
    maxWidth: 1080, margin: "0 auto", paddingBottom: 80 },

  // ---- indigo header bar ----
  header: { display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "18px 24px", flexWrap: "wrap", gap: 12, background: T.water, color: "#fff" },
  headLeft: { display: "flex", alignItems: "center", gap: 14 },
  mark: { display: "flex", flexDirection: "column", gap: 2, padding: 6,
    background: T.water, borderRadius: 8 },
  markRow: { display: "flex", gap: 2 },
  markDot: { width: 5, height: 5, borderRadius: 1, background: "#fff", opacity: .95, display: "block" },
  brand: { fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: "-.01em", color: "#fff" },
  brandRow: { display: "flex", alignItems: "center", gap: 8 },
  newBldBtn: { height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.16)", color: "#fff", fontSize: 13, fontWeight: 600, lineHeight: 1, cursor: "pointer", fontFamily: display, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0, whiteSpace: "nowrap" },
  switcher: { fontFamily: display, fontWeight: 700, fontSize: 18, color: "#fff",
    background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 8,
    padding: "3px 8px", cursor: "pointer", maxWidth: 230 },
  addBldLink: { border: "none", background: "transparent", color: "rgba(255,255,255,.9)", cursor: "pointer",
    fontSize: 12, fontWeight: 600, fontFamily: font, padding: 0, textDecoration: "underline" },
  brandSub: { fontSize: 12.5, color: "rgba(255,255,255,.8)", marginTop: 1 },
  headRight: { display: "flex", alignItems: "center", gap: 12 },
  monthPill: { fontFamily: mono, fontSize: 13, fontWeight: 600, color: "#fff",
    background: "rgba(255,255,255,.18)", padding: "6px 12px", borderRadius: 20 },
  monthBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  monthRange: { fontFamily: mono, fontSize: 10.5, color: "rgba(255,255,255,.8)", whiteSpace: "nowrap" },
  who: { fontSize: 12.5, color: "rgba(255,255,255,.85)", textAlign: "right", lineHeight: 1.5 },
  userBox: { display: "flex", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: "50%", background: "#fff", color: T.water,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display,
    fontWeight: 700, fontSize: 15, flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,.15)" },
  userMeta: { display: "flex", flexDirection: "column", lineHeight: 1.25 },
  userName: { fontFamily: display, fontWeight: 700, fontSize: 15.5, color: "#fff", letterSpacing: "-.01em" },
  userSub: { fontSize: 11.5, color: "rgba(255,255,255,.82)" },
  signout: { border: "none", background: "transparent", color: "#fff", cursor: "pointer",
    fontSize: 11.5, fontWeight: 600, padding: 0, fontFamily: font, textDecoration: "underline",
    textAlign: "left", marginTop: 2, opacity: .9 },

  tabs: { display: "flex", gap: 4, padding: "0 24px", background: T.surface,
    borderBottom: `1px solid ${T.line}`, overflowX: "auto" },
  tab: { border: "none", background: "transparent", padding: "13px 16px", fontSize: 14, fontWeight: 600,
    cursor: "pointer", color: T.muted, borderBottomWidth: 3, borderBottomStyle: "solid", borderBottomColor: "transparent", marginBottom: -1,
    fontFamily: display, whiteSpace: "nowrap" },
  tabOn: { color: T.water, borderBottomColor: T.water },
  main: { padding: "20px 24px" },

  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 8 },
  card: { ...card, padding: "16px 18px" },
  cardLabel: { fontSize: 12.5, color: T.inkSoft, fontWeight: 500 },
  cardValue: { fontFamily: mono, fontSize: 26, fontWeight: 600, margin: "6px 0 2px", letterSpacing: "-.02em" },
  cardNote: { fontSize: 12, color: T.muted },

  section: { fontFamily: display, fontSize: 16, fontWeight: 700, margin: "26px 0 12px", letterSpacing: "-.01em" },
  titleHint: { fontFamily: font, fontWeight: 400, fontSize: 13, color: T.muted },

  // ---- flat status tile grid (Bill-Collection style) ----
  legend: { display: "flex", gap: 16, flexWrap: "wrap", margin: "4px 0 14px" },
  legendItem: { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.inkSoft, fontWeight: 500 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  tileGrid: { display: "grid", gap: 10, background: "#EDEDF6", padding: 14, borderRadius: 14 },
  tile: { border: "none", borderRadius: 10, color: "#fff", cursor: "pointer",
    minHeight: 66, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    fontFamily: display, fontWeight: 700, fontSize: 19, gap: 2 },
  tileSub: { fontSize: 10.5, fontWeight: 600, opacity: .92, textTransform: "uppercase", letterSpacing: ".03em" },

  tableWrap: { ...card, overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: { textAlign: "left", padding: "11px 12px", fontSize: 11.5, fontWeight: 600, color: T.inkSoft,
    textTransform: "uppercase", letterSpacing: ".04em", background: "#F7F7FC", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" },
  td: { padding: "10px 12px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" },
  num: { fontFamily: mono, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  tfoot: { padding: "11px 12px", fontWeight: 700, fontSize: 13, background: "#F7F7FC", borderTop: `2px solid ${T.line}` },

  cellInput: { width: 96, padding: "6px 8px", border: `1px solid ${T.line}`, borderRadius: 6,
    fontSize: 13, textAlign: "right", background: "#fff", color: T.ink },
  cellSelect: { padding: "6px 8px", border: `1px solid ${T.line}`, borderRadius: 6, fontSize: 12.5,
    background: "#fff", color: T.ink, fontFamily: font, maxWidth: 200 },

  inputGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, ...card, padding: "12px 14px" },
  fieldLabel: { fontSize: 12.5, fontWeight: 600, color: T.ink },
  fieldSub: { fontWeight: 400, color: T.muted, fontSize: 11.5 },
  fieldInputWrap: { position: "relative", display: "flex", alignItems: "center" },
  fieldPrefix: { position: "absolute", left: 10, color: T.muted, fontFamily: mono, fontSize: 14 },
  fieldInput: { width: "100%", padding: "9px 12px", border: `1px solid ${T.line}`, borderRadius: 8,
    fontFamily: mono, fontSize: 15, fontWeight: 600, color: T.ink, background: "#fff" },

  costStrip: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14,
    background: T.waterSoft, borderRadius: 12, padding: "12px 16px", fontSize: 13.5, color: T.inkSoft },
  plus: { color: T.water, fontWeight: 700 },
  costTotal: { fontFamily: mono, fontWeight: 700, fontSize: 18, color: T.water, marginLeft: "auto" },

  reimbList: { ...card, overflow: "hidden" },
  reimbRow: { display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px", borderBottom: `1px solid ${T.line}`, fontSize: 14 },

  addBtn: { marginTop: 12, padding: "9px 16px", border: `1.5px solid ${T.water}`, background: "#fff",
    color: T.water, borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: display },
  del: { border: "none", background: "transparent", color: T.owed, cursor: "pointer", fontSize: 13 },
  note: { fontSize: 12.5, color: T.muted, marginTop: 10, lineHeight: 1.5 },

  stWrap: { maxWidth: 460 },
  stHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  stFlat: { fontFamily: display, fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" },
  stName: { fontSize: 14, color: T.inkSoft, marginTop: 1 },
  stTotalBox: { textAlign: "right" },
  stTotalLabel: { fontSize: 11.5, color: T.muted },
  stTotal: { fontFamily: mono, fontSize: 28, fontWeight: 600, color: T.ink },
  stGroup: { fontFamily: display, fontSize: 13.5, fontWeight: 700, color: T.water,
    marginTop: 16, marginBottom: 2, paddingBottom: 6, borderBottom: `1px solid ${T.line}` },
  stLine: { display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 0", fontSize: 14, borderBottom: `1px solid #F1F1F8` },
  stLineStrong: { borderTop: `2px solid ${T.ink}`, borderBottom: "none", marginTop: 8, paddingTop: 12, fontSize: 15.5 },
  stSub: { fontSize: 12, color: T.muted, marginTop: 1 },
  stOwed: { marginTop: 16, background: T.owedSoft, color: T.owed, padding: "12px 14px",
    borderRadius: 10, fontSize: 13.5, lineHeight: 1.5 },

  drawerBack: { position: "fixed", inset: 0, background: "rgba(32,35,63,.4)", display: "flex",
    justifyContent: "flex-end", zIndex: 50 },
  drawer: { width: "min(440px, 92vw)", height: "100%", background: T.surface, padding: "28px 26px",
    overflowY: "auto", position: "relative", boxShadow: "-8px 0 30px rgba(0,0,0,.14)" },
  drawerClose: { position: "absolute", top: 16, right: 16, border: "none", background: "#F1F1F8",
    width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 13, color: T.inkSoft },

  saveBar: { position: "fixed", bottom: 0, left: 0, right: 0, background: T.ink, color: "#fff",
    display: "flex", justifyContent: "center", gap: 16, alignItems: "center", padding: "12px 24px", zIndex: 40 },
  saveBarInner: { maxWidth: 1080, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, fontSize: 14 },
  primaryBtn: { background: T.water, color: "#fff", border: "none", borderRadius: 10,
    padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: display },
  ghostBtn: { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.3)",
    borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: display },
  ghostBtn2: { background: "#fff", color: T.inkSoft, border: `1px solid ${T.line}`,
    borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: display },

  inviteBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    flexWrap: "wrap", background: T.waterSoft, border: `1px solid ${T.line}`, borderRadius: 12,
    padding: "12px 16px", marginBottom: 14, fontSize: 13.5, color: T.inkSoft },
  billingStrip: { display: "flex", alignItems: "stretch", gap: 0, flexWrap: "wrap",
    background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px", marginBottom: 16 },
  billingCol: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 200 },
  billingDivide: { width: 1, background: T.line, margin: "0 18px" },
  billingKind: { fontSize: 12.5, fontWeight: 600, color: T.inkSoft },
  billingVal: { fontFamily: display, fontWeight: 700, fontSize: 17, color: T.ink, letterSpacing: "-.01em" },
  billingDates: { fontFamily: mono, fontSize: 12.5, color: T.muted },
  viewNote: { background: "#F7F7FC", border: `1px solid ${T.line}`, borderRadius: 10,
    padding: "10px 14px", fontSize: 13, color: T.inkSoft, marginBottom: 4 },
  periodBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
    marginTop: 16, background: T.ink, color: "#fff", borderRadius: 12, padding: "14px 18px" },
  periodLabel: { fontFamily: display, fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".05em", opacity: .8 },
  periodDates: { fontFamily: mono, fontWeight: 600, fontSize: 16 },
  periodHead: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 },
  periodPickRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 14px" },
  periodPickLabel: { fontSize: 12.5, fontWeight: 600, color: T.inkSoft },
  periodPickSelect: { padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 9, fontSize: 13.5,
    background: "#fff", color: T.ink, fontFamily: mono, fontWeight: 600, minWidth: 260 },
  periodPickNote: { fontSize: 12, color: T.owed, fontWeight: 600 },
  delPeriodBtn: { marginTop: 12, padding: "9px 14px", border: `1.5px solid ${T.owed}`, background: "#fff", color: T.owed, borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: display },
  backfillBtn: { marginTop: 12, padding: "9px 14px", border: `1.5px solid ${T.water}`, background: "#fff", color: T.water, borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: display },
  publishBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
    marginTop: 22, background: T.waterSoft, border: `1.5px solid ${T.water}`, borderRadius: 14, padding: "14px 18px" },
  publishTitle: { fontFamily: display, fontWeight: 700, fontSize: 15, color: T.ink, textTransform: "capitalize" },
  publishSub: { fontSize: 12.5, color: T.inkSoft, marginTop: 3, maxWidth: 520, lineHeight: 1.45 },
  pubPanel: { background: "#fff", borderRadius: 16, width: "min(560px,100%)", maxHeight: "90vh", overflow: "auto", padding: 20, boxShadow: "0 12px 50px rgba(0,0,0,.2)" },
  pubHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  pubTitle: { fontFamily: display, fontWeight: 800, fontSize: 18, textTransform: "capitalize" },
  pubClose: { border: "none", background: "#F1F1F8", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 13, color: T.inkSoft },
  pubHint: { fontSize: 12.5, color: T.inkSoft, marginBottom: 10, lineHeight: 1.45 },
  pubTabs: { display: "flex", gap: 0, marginBottom: 14, borderBottom: `1px solid ${T.line}` },
  pubTab: { flex: 1, padding: "10px 8px", border: "none", background: "none", fontWeight: 600, fontSize: 13.5,
    cursor: "pointer", fontFamily: display, color: T.muted, borderBottom: "2px solid transparent" },
  pubTabOn: { color: T.water, borderBottomColor: T.water },
  pubImg: { width: "100%", borderRadius: 10, border: `1px solid ${T.line}`, marginBottom: 10 },
  pubPre: { background: "#F6F7FB", border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, fontFamily: mono,
    fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: T.ink, maxHeight: "52vh", overflow: "auto" },
  pubFoot: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 },

  footer: { textAlign: "center", fontSize: 12, color: T.muted, padding: "24px" },
};
