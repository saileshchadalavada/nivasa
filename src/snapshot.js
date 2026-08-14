/* WhatsApp text snapshots — full detail matching the Excel register. */
import { money, daysBetween } from "./util";

const kl = (l) => (Number(l || 0) / 1000).toFixed(1);
const pctChange = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const arrow = (d) => (d == null ? "—" : d > 0 ? `+${d}%` : d < 0 ? `${d}%` : "0%");
const pad = (s, n) => (String(s) + " ".repeat(n)).slice(0, n);
const padL = (s, n) => (" ".repeat(n) + String(s)).slice(-n);

function waterCaption(delta) {
  if (delta == null) return "💧 Let's keep our usage in check — fix dripping taps and report leaks early.";
  if (delta <= -10) return `🎉 Great job! We used ${Math.abs(delta)}% less water than last month. Keep it up! 💧`;
  if (delta < 0) return "👍 Usage dipped slightly — small habits add up. Keep saving water. 💧";
  if (delta === 0) return "💧 Usage held steady. Let's aim to bring it down — every drop counts.";
  if (delta >= 20) return `⚠️ Usage jumped ${delta}%. Please check for leaks — let's save water together. 💧`;
  return `💧 Usage rose ${delta}%. A few mindful habits can bring it back down!`;
}

export function buildWaterSnapshot({ name, label, start, end, startIso, endIso, rows, prevCons, grandTotal, costItems }) {
  const all = rows || [];
  const res = all.filter((r) => !r.isCommon);
  const common = all.find((r) => r.isCommon);
  const totalUsed = all.reduce((s, r) => s + (r.cons || 0), 0);
  const prevTotal = Object.values(prevCons || {}).reduce((s, v) => s + v, 0);
  const bldDelta = pctChange(totalUsed, prevTotal);
  const days = daysBetween(startIso, endIso);

  const costLines = (costItems || []).filter((ci) => ci.total > 0).map((ci) => {
    const splitLabel = ci.split === "percent" ? "by %" : "equal";
    return `*${ci.label || "Cost"}:* ${ci.quantity} × ₹${ci.rate} = ${money(ci.total)} (${splitLabel})`;
  });

  const lines = [
    `💧 *${name} — Water Bill*`,
    `*${label}*  ·  ${start} → ${end}${days != null ? `  (${days} days)` : ""}`,
    "",
    ...costLines,
    `*Grand total:* ${money(grandTotal)}`,
    "",
  ];

  // table header
  const hdr = `${pad("Flat",5)}${pad("Name",16)}${pad("Meter",9)}${padL("Prev",10)}${padL("Curr",10)}${padL("Used",8)}${padL("%",6)}${padL("Chg",7)}${padL("Bill",8)}`;
  const tbl = [hdr];

  const addRow = (r) => {
    const nm = (r.name || r.flat || "").slice(0, 14);
    const d = arrow(pctChange(r.cons, prevCons ? prevCons[r.flat] : null));
    tbl.push(`${pad(r.flat,5)}${pad(nm,16)}${pad(r.meter||"",9)}${padL((Number(r.prev)||0).toFixed(1),10)}${padL(r.curr===""?"—":Number(r.curr).toFixed(1),10)}${padL(r.cons.toFixed(1),8)}${padL(r.pct.toFixed(1),6)}${padL(d,7)}${padL(r.isCommon?"—":money(r.bill),8)}`);
  };

  // series 1 (x01), series 2 (x02), series 3 (x03)
  [1,2,3].forEach((s) => {
    const group = res.filter((r) => String(r.flat).endsWith(String(s)));
    group.forEach(addRow);
  });
  if (common) { tbl.push(""); addRow(common); }
  tbl.push(`${pad("Total",30)}${padL("",10)}${padL("",10)}${padL(totalUsed.toFixed(1),8)}${padL("100.0",6)}${padL(arrow(bldDelta),7)}${padL(money(grandTotal),8)}`);

  lines.push("```" + tbl.join("\n") + "```");
  lines.push("", waterCaption(bldDelta), "", "_Full details in the Nivasa app._");
  return lines.join("\n");
}

export function buildMaintSnapshot({ name, label, start, end, startIso, endIso, expenses, total, perFlat, nRes, byMember }) {
  const items = (expenses || []).filter((e) => Number(e.amount) > 0);
  const owed = Object.entries(byMember || {});
  const days = daysBetween(startIso, endIso);
  const tbl = items.map((e) => `${pad(e.item || "—", 26)}${padL(money(e.amount), 9)}`);
  const flatCount = nRes || "?";
  return [
    `🧰 *${name} — Maintenance*`,
    `*${label}*  ·  ${start} → ${end}${days != null ? `  (${days} days)` : ""}`,
    "",
    "```" + tbl.join("\n") + "```",
    "",
    `*Total:* ${money(total)}  ·  *Per flat:* ${money(perFlat)} (÷${flatCount})`,
    ...(owed.length ? ["", "*Owed back to members:*", ...owed.map(([f, a]) => `• Flat ${f}: ${money(a)}`)] : []),
    "",
    "_Itemised details in the Nivasa app._",
  ].join("\n");
}
