import React, { useState, useMemo } from "react";
import { money } from "./util";
import { styles as S, T, css, display, mono, font } from "./styles";
import { computeBalance } from "./billing/accountEngine";

/* Broadcast bills to residents via WhatsApp or copy-paste.
   Shows per-flat breakdown with "Send via WhatsApp" per row + "Copy all". */

function buildMessage({ name, waterBill, maintCharge, corpusCharge, balanceDue, reimbursementPending, periodLabel, buildingName }) {
  const lines = [
    `Hi ${name},`,
    `Your ${periodLabel} bill for ${buildingName}:`,
    "",
    `💧 Water: ${money(waterBill)}`,
    `🔧 Maintenance: ${money(maintCharge)}`,
  ];
  if (corpusCharge > 0) lines.push(`🏦 Corpus: ${money(corpusCharge)}`);
  if (reimbursementPending > 0) lines.push(`💚 Association owes you: ${money(reimbursementPending)}`);
  lines.push("", `📋 Total due: ${money(balanceDue)}`, "", "— Nivasa");
  return lines.join("\n");
}

function cleanPhone(ph) {
  if (!ph) return "";
  const digits = ph.replace(/[^\d]/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.startsWith("91") && digits.length === 12) return digits;
  return digits;
}

export default function Broadcast({ residential, members, water, maint, waterPeriod, maintPeriod, config, onClose }) {
  const [copied, setCopied] = useState(false);

  const periodLabel = [waterPeriod?.label, maintPeriod?.label].filter(Boolean).join(" / ") || "this month";
  const buildingName = config?.name || "your building";

  const corpusCharge = Number(config?.corpus?.monthly || 0);

  const rows = useMemo(() => residential.map((f) => {
    const member = members.find((m) => m.flat === f.flat);
    const waterBill = water.rows.find((r) => r.flat === f.flat)?.bill || 0;
    const owedByFlat = maint.byMember[f.flat] || 0;
    const bal = computeBalance({ waterCharge: waterBill, maintCharge: maint.perFlat, corpusCharge, owedByFlat });
    const msg = buildMessage({
      name: f.name || member?.username || `Flat ${f.flat}`,
      waterBill, maintCharge: maint.perFlat, corpusCharge,
      balanceDue: bal.balanceDue, reimbursementPending: bal.reimbursementPending,
      periodLabel, buildingName,
    });
    const phone = member?.phone || "";
    return { flat: f.flat, name: f.name || "", phone, waterBill, maintCharge: maint.perFlat, owedByFlat, ...bal, msg };
  }), [residential, members, water, maint, corpusCharge, periodLabel, buildingName]);

  const allMessages = rows.map((r) => `--- Flat ${r.flat} ---\n${r.msg}`).join("\n\n");

  const copyAll = () => {
    navigator.clipboard.writeText(allMessages).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((e) => console.error("Clipboard copy failed:", e));
  };

  const openWhatsApp = (phone, msg) => {
    const clean = cleanPhone(phone);
    const url = clean
      ? `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div style={B.back} onClick={onClose}>
      <div style={B.panel} onClick={(e) => e.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div style={B.head}>
          <div>
            <div style={B.title}>📢 Broadcast bills</div>
            <div style={B.sub}>Send {periodLabel} bills to each flat via WhatsApp or copy all messages.</div>
          </div>
          <button style={B.close} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "9px 16px" }} onClick={copyAll}>
            {copied ? "✓ Copied!" : "📋 Copy all messages"}
          </button>
          <span style={{ fontSize: 12.5, color: T.muted, alignSelf: "center" }}>
            {rows.filter((r) => r.phone).length} of {rows.length} have phone numbers
          </span>
        </div>

        <div style={{ maxHeight: 460, overflowY: "auto" }}>
          {rows.map((r) => (
            <div key={r.flat} style={B.row}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{r.flat}</span>
                  <span style={{ color: T.inkSoft, fontSize: 13, marginLeft: 8 }}>{r.name}</span>
                  {r.phone && <span style={{ color: T.muted, fontSize: 11.5, marginLeft: 8, fontFamily: mono }}>{r.phone}</span>}
                </div>
                <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 15, color: r.reimbursementPending > 0.01 ? T.water : T.ink }}>{money(r.balanceDue)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: T.inkSoft, marginBottom: 8 }}>
                <span>💧 {money(r.waterBill)}</span>
                <span>🔧 {money(r.maintCharge)}</span>
                {corpusCharge > 0 && <span>🏦 {money(corpusCharge)}</span>}
                {r.reimbursementPending > 0.01 && <span style={{ color: T.water }}>↺ {money(r.reimbursementPending)} owed back</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={B.waBtn} onClick={() => openWhatsApp(r.phone, r.msg)}>
                  {r.phone ? "💬 Send WhatsApp" : "💬 WhatsApp (no number)"}
                </button>
                <button style={B.copyBtn} onClick={() => {
                  navigator.clipboard.writeText(r.msg).catch((e) => console.error("Copy failed:", e));
                }}>Copy</button>
              </div>
            </div>
          ))}
        </div>

        <div style={B.foot}>
          <button style={S.ghostBtn2} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const B = {
  back: { position: "fixed", inset: 0, background: "rgba(32,35,63,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16, fontFamily: font },
  panel: { background: "#fff", borderRadius: 16, width: "min(620px,100%)", maxHeight: "92vh", overflow: "auto", padding: 22, boxShadow: "0 12px 50px rgba(0,0,0,.2)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  title: { fontFamily: display, fontWeight: 800, fontSize: 19, letterSpacing: "-.01em" },
  sub: { fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.45 },
  close: { border: "none", background: "#F1F1F8", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 13, color: T.inkSoft, flexShrink: 0 },
  row: { background: "#FAFBFE", border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 },
  waBtn: { background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font },
  copyBtn: { background: "#fff", color: T.inkSoft, border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font },
  foot: { display: "flex", justifyContent: "flex-end", marginTop: 16 },
};
