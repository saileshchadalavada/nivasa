/* Branded PNG poster for WhatsApp — full detail with all meter readings.
   Canvas-rendered, no server. Indigo header + white table + bold black data. */
import { money, daysBetween } from "./util";

const INDIGO = "#4B3FC0", DARK = "#3B30A0", WHITE = "#FFF", BLACK = "#1A1A2E";
const GRAY = "#6B7280", LIGHT = "#F6F7FB", GREEN = "#1E7F4C", RED = "#D94343";
const FONT = "Inter, Helvetica, Arial, sans-serif";
const MONO = "'Spline Sans Mono', 'SF Mono', Consolas, monospace";
const DPR = 2, W = 960 * DPR, PAD = 20 * DPR;

const pctChange = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const arrow = (d) => (d == null ? "—" : d > 0 ? `▲${d}%` : d < 0 ? `▼${Math.abs(d)}%` : "0%");
const kl = (l) => (Number(l || 0) / 1000).toFixed(1);
const fmt = (v) => v == null || v === "" ? "—" : Number(v).toFixed(1);

function waterCaption(delta) {
  if (delta == null) return "💧 Let's keep our usage in check — fix dripping taps and report leaks early.";
  if (delta <= -10) return `🎉 Great job! We used ${Math.abs(delta)}% less water than last month!`;
  if (delta < 0) return "👍 Usage dipped slightly — small habits add up. Keep saving water. 💧";
  if (delta === 0) return "💧 Usage held steady. Let's aim to bring it down — every drop counts.";
  if (delta >= 20) return `⚠️ Usage jumped ${delta}%. Please check for leaks!`;
  return `💧 Usage rose ${delta}%. A few mindful habits can bring it back down!`;
}

export function generateWaterPoster({ name, label, start, end, startIso, endIso, rows, prevCons, grandTotal, costItems }) {
  const all = rows || [];
  const res = all.filter((r) => !r.isCommon);
  const common = all.find((r) => r.isCommon);
  const dataRows = [...res, ...(common ? [common] : [])];
  const totalUsed = all.reduce((s, r) => s + (r.cons || 0), 0);
  const prevTotal = Object.values(prevCons || {}).reduce((s, v) => s + v, 0);
  const bldDelta = pctChange(totalUsed, prevTotal);
  const days = daysBetween(startIso, endIso);

  // cost breakdown lines (computed early so we can size the header)
  const costLines = (costItems || []).filter((ci) => ci.total > 0).map((ci) => {
    const splitLabel = ci.split === "percent" ? "by %" : "equal";
    return `${ci.label || "Cost"}: ${ci.quantity} × ₹${ci.rate} = ${money(ci.total)} (${splitLabel})`;
  });
  costLines.push(`Grand total: ${money(grandTotal)}`);

  const ROW_H = 34 * DPR, TBL_HDR = 30 * DPR, FOOT_H = 70 * DPR;
  // header grows with cost lines: base 82px for title+date, then 20px per cost line, plus 12px padding
  const HDR_H = (82 + costLines.length * 20 + 12) * DPR;
  const totalH = HDR_H + TBL_HDR + dataRows.length * ROW_H + 38*DPR + FOOT_H + PAD;

  const c = document.createElement("canvas"); c.width = W; c.height = totalH;
  const ctx = c.getContext("2d");
  ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, totalH);

  // header band
  const grad = ctx.createLinearGradient(0, 0, W, HDR_H);
  grad.addColorStop(0, INDIGO); grad.addColorStop(1, DARK);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, HDR_H);

  ctx.fillStyle = WHITE; ctx.font = `bold ${28*DPR}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(`💧 ${name} — Water Bill`, PAD, 36*DPR);
  ctx.font = `${16*DPR}px ${FONT}`; ctx.globalAlpha = 0.9;
  ctx.fillText(`${label}  ·  ${start} → ${end}${days != null ? `  (${days} days)` : ""}`, PAD, 62*DPR);

  // cost breakdown in header
  ctx.font = `${14*DPR}px ${MONO}`; ctx.globalAlpha = 0.85;
  costLines.forEach((l, i) => ctx.fillText(l, PAD, (82 + i*20)*DPR));
  ctx.globalAlpha = 1;

  // columns: Flat, Name, Meter, Prev, Curr, Used, %, vsLast, Bill
  const cols = [PAD, 60*DPR, 220*DPR, 310*DPR, 430*DPR, 550*DPR, 650*DPR, 720*DPR, 810*DPR, W-PAD];
  const hdrs = ["Flat","Name","Meter","Previous","Current","Used","% ","vs Last","Bill (₹)"];
  const aligns = ["left","left","left","right","right","right","right","right","right"];

  let y = HDR_H + 8*DPR;
  // table header
  ctx.fillStyle = INDIGO; ctx.fillRect(PAD, y, W-PAD*2, TBL_HDR);
  ctx.fillStyle = WHITE; ctx.font = `bold ${12*DPR}px ${FONT}`;
  hdrs.forEach((h, i) => {
    ctx.textAlign = aligns[i];
    const tx = aligns[i] === "right" ? cols[i+1] - 6*DPR : cols[i] + 6*DPR;
    ctx.fillText(h, tx, y + 20*DPR);
  });
  y += TBL_HDR;

  // data rows
  dataRows.forEach((r, ri) => {
    const bg = r.isCommon ? "#EEF0F6" : ri % 2 === 0 ? WHITE : LIGHT;
    ctx.fillStyle = bg; ctx.fillRect(PAD, y, W-PAD*2, ROW_H);

    const vals = [
      r.flat, (r.name||r.flat||"").slice(0,14), r.meter||"",
      fmt(r.prev), r.curr===""?"—":fmt(r.curr), r.cons.toFixed(1),
      r.pct.toFixed(1), null, r.isCommon?"—":money(r.bill)
    ];
    const d = pctChange(r.cons, prevCons?prevCons[r.flat]:null);

    vals.forEach((v, i) => {
      if (i === 7) return; // vsLast handled separately for color
      ctx.fillStyle = BLACK;
      ctx.font = (i===0||i===8) ? `bold ${13*DPR}px ${FONT}` : `${13*DPR}px ${i>=3?MONO:FONT}`;
      ctx.textAlign = aligns[i];
      const tx = aligns[i]==="right" ? cols[i+1]-6*DPR : cols[i]+6*DPR;
      ctx.fillText(String(v), tx, y+22*DPR);
    });
    // vs Last with color
    ctx.fillStyle = d!=null&&d>0 ? RED : d!=null&&d<0 ? GREEN : GRAY;
    ctx.font = `bold ${12*DPR}px ${MONO}`; ctx.textAlign = "right";
    ctx.fillText(arrow(d), cols[8]-6*DPR, y+22*DPR);
    y += ROW_H;
  });

  // totals row
  ctx.fillStyle = INDIGO; ctx.fillRect(PAD, y, W-PAD*2, 36*DPR);
  ctx.fillStyle = WHITE; ctx.font = `bold ${13*DPR}px ${FONT}`; ctx.textAlign = "left";
  ctx.fillText("Total", cols[0]+6*DPR, y+24*DPR);
  ctx.font = `bold ${13*DPR}px ${MONO}`; ctx.textAlign = "right";
  ctx.fillText(totalUsed.toFixed(1), cols[6]-6*DPR, y+24*DPR);
  ctx.fillText("100.0", cols[7]-6*DPR, y+24*DPR);
  if (bldDelta!=null) {
    ctx.fillStyle = bldDelta>0?"#FFAAAA":bldDelta<0?"#AAFFCC":WHITE;
    ctx.fillText(arrow(bldDelta), cols[8]-6*DPR, y+24*DPR);
  }
  ctx.fillStyle = WHITE; ctx.fillText(money(grandTotal), cols[9]-6*DPR, y+24*DPR);
  y += 40*DPR;

  // footer
  ctx.fillStyle = LIGHT; ctx.fillRect(0, y, W, FOOT_H);
  ctx.fillStyle = BLACK; ctx.font = `${15*DPR}px ${FONT}`; ctx.textAlign = "center";
  ctx.fillText(waterCaption(bldDelta), W/2, y+28*DPR);
  ctx.fillStyle = GRAY; ctx.font = `${11*DPR}px ${FONT}`;
  ctx.fillText("Generated by Nivasa · Full details in the app", W/2, y+52*DPR);

  return c;
}

export function generateMaintPoster({ name, label, start, end, startIso, endIso, expenses, total, perFlat, byMember }) {
  const items = (expenses||[]).filter((e)=>Number(e.amount)>0);
  const owed = Object.entries(byMember||{});
  const days = daysBetween(startIso, endIso);
  const ROW_H=32*DPR, HDR_H=100*DPR, TBL_HDR=30*DPR;
  const FOOT_H=(70+(owed.length?owed.length*22:0))*DPR;
  const totalH = HDR_H+TBL_HDR+items.length*ROW_H+38*DPR+FOOT_H+PAD;

  const c=document.createElement("canvas"); c.width=W; c.height=totalH;
  const ctx=c.getContext("2d");
  ctx.fillStyle=WHITE; ctx.fillRect(0,0,W,totalH);

  const grad=ctx.createLinearGradient(0,0,W,HDR_H);
  grad.addColorStop(0,INDIGO); grad.addColorStop(1,DARK);
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,HDR_H);
  ctx.fillStyle=WHITE; ctx.font=`bold ${28*DPR}px ${FONT}`; ctx.textAlign="left";
  ctx.fillText(`🧰 ${name} — Maintenance`, PAD, 40*DPR);
  ctx.font=`${16*DPR}px ${FONT}`; ctx.globalAlpha=0.9;
  ctx.fillText(`${label}  ·  ${start} → ${end}${days != null ? `  (${days} days)` : ""}`, PAD, 68*DPR);
  ctx.globalAlpha=1;

  let y=HDR_H+8*DPR;
  ctx.fillStyle=INDIGO; ctx.fillRect(PAD,y,W-PAD*2,TBL_HDR);
  ctx.fillStyle=WHITE; ctx.font=`bold ${12*DPR}px ${FONT}`;
  ctx.textAlign="left"; ctx.fillText("Item",PAD+6*DPR,y+20*DPR);
  ctx.textAlign="right"; ctx.fillText("Amount (₹)",W-PAD-6*DPR,y+20*DPR);
  ctx.textAlign="center"; ctx.fillText("Paid by",(W-PAD*2)*0.7+PAD,y+20*DPR);
  y+=TBL_HDR;

  items.forEach((e,i)=>{
    ctx.fillStyle=i%2===0?WHITE:LIGHT; ctx.fillRect(PAD,y,W-PAD*2,ROW_H);
    ctx.fillStyle=BLACK; ctx.font=`${12*DPR}px ${FONT}`; ctx.textAlign="left";
    ctx.fillText(e.item||"—",PAD+6*DPR,y+21*DPR);
    ctx.font=`bold ${12*DPR}px ${MONO}`; ctx.textAlign="right";
    ctx.fillText(money(e.amount),W-PAD-6*DPR,y+21*DPR);
    ctx.font=`${11*DPR}px ${FONT}`; ctx.textAlign="center"; ctx.fillStyle=GRAY;
    ctx.fillText(e.paidBy==="fund"?"Fund":`Flat ${e.paidBy}`,(W-PAD*2)*0.7+PAD,y+21*DPR);
    y+=ROW_H;
  });

  ctx.fillStyle=INDIGO; ctx.fillRect(PAD,y,W-PAD*2,36*DPR);
  ctx.fillStyle=WHITE; ctx.font=`bold ${13*DPR}px ${FONT}`; ctx.textAlign="left";
  ctx.fillText(`Total: ${money(total)}  ·  Per flat: ${money(perFlat)}`,PAD+6*DPR,y+24*DPR);
  y+=40*DPR;

  ctx.fillStyle=LIGHT; ctx.fillRect(0,y,W,FOOT_H);
  if(owed.length){
    ctx.fillStyle=RED; ctx.font=`bold ${12*DPR}px ${FONT}`; ctx.textAlign="left";
    ctx.fillText("Owed back to members:",PAD,y+22*DPR);
    owed.forEach(([f,a],i)=>{ctx.fillStyle=BLACK;ctx.font=`${12*DPR}px ${FONT}`;ctx.fillText(`Flat ${f}: ${money(a)}`,PAD+14*DPR,y+(42+i*22)*DPR);});
  }
  ctx.fillStyle=GRAY; ctx.font=`${10*DPR}px ${FONT}`; ctx.textAlign="center";
  ctx.fillText("Generated by Nivasa · Full details in the app",W/2,y+FOOT_H-12*DPR);
  return c;
}

export function canvasToBlob(canvas) { return new Promise((r)=>canvas.toBlob(r,"image/png")); }

export async function sharePoster(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return "shared"; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  return "downloaded";
}
