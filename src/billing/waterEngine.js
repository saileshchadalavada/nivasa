/* Canonical water billing engine — pure function, no React, no Firestore.
   Every water calculation in the app MUST use this engine.
   Consumers: Dashboard, History, snapshot, poster, Broadcast.

   FIN-05 common meter policy (current: "include_percent"):
     Common meter participates in percentage-based cost splits.
     Its computed bill is reported as commonLiability — an association cost
     that is NOT collected from any resident. The invariant is:
       residentialBillTotal + commonLiability === grandTotal + totalAdjustments
     (subject to floating-point rounding)
*/

/**
 * @param {Object} period - Water period document (readings, costItems, legacy fields)
 * @param {Array}  flats  - Flat documents [{flat, name, meter, isCommon, ...}]
 * @param {Object} [opts] - { commonPolicy: "include_percent" } (reserved for future)
 * @returns {Object} Canonical water billing result
 */
export function computeWater(period, flats, opts = {}) {
  const M = period;
  if (!M) return empty();

  const allMeters = flats || [];
  const nRes = allMeters.filter((f) => !f.isCommon).length || 1;

  // Build per-flat consumption rows
  const rows = allMeters.map((f) => {
    const r = M.readings?.[f.flat] || { prev: 0, curr: 0, adj: 0 };
    const cons = Math.max(0, (r.curr || 0) - (r.prev || 0));
    return { ...f, prev: r.prev || 0, curr: r.curr, adj: r.adj || 0, cons };
  });

  const rawCons = rows.reduce((s, r) => s + r.cons, 0);
  const totalCons = rawCons || 1;
  const resCons = rows.filter((r) => !r.isCommon).reduce((s, r) => s + r.cons, 0) || 1;

  // Build costItems: use new flexible array if present, else synthesize from legacy fields
  let costItems;
  if (M.costItems && M.costItems.length > 0) {
    costItems = M.costItems.map((ci) => ({
      ...ci,
      quantity: Number(ci.quantity) || 0,
      rate: Number(ci.rate) || 0,
      total: (Number(ci.quantity) || 0) * (Number(ci.rate) || 0),
    }));
  } else {
    costItems = [];
    if ((M.genCount || 0) > 0 || (M.genRate || 0) > 0)
      costItems.push({ id: "_gen", label: "General tankers", quantity: Number(M.genCount) || 0, rate: Number(M.genRate) || 0, total: (Number(M.genCount) || 0) * (Number(M.genRate) || 0), split: "percent" });
    if ((M.manCount || 0) > 0 || (M.manRate || 0) > 0)
      costItems.push({ id: "_man", label: "Manjeera tankers", quantity: Number(M.manCount) || 0, rate: Number(M.manRate) || 0, total: (Number(M.manCount) || 0) * (Number(M.manRate) || 0), split: "equal" });
    if ((M.connBill || 0) > 0)
      costItems.push({ id: "_conn", label: "Manjeera connection (HMWSSB)", quantity: 1, rate: Number(M.connBill) || 0, total: Number(M.connBill) || 0, split: "equal" });
  }

  const grandTotal = costItems.reduce((s, ci) => s + ci.total, 0);

  // Per-flat billing: each cost item split independently by its method
  const detailed = rows.map((r) => {
    const pct = (r.cons / totalCons) * 100;
    const itemShares = costItems.map((ci) => {
      let share = 0;
      if (ci.split === "percent") {
        share = (r.cons / totalCons) * ci.total;
      } else {
        share = r.isCommon ? 0 : ci.total / nRes;
      }
      return { id: ci.id, label: ci.label, share };
    });
    const bill = itemShares.reduce((s, is) => s + is.share, 0) + (r.isCommon ? 0 : (r.adj || 0));
    return { ...r, pct, itemShares, bill };
  });

  // FIN-05: separate residential total from common liability
  const residentialBillTotal = detailed.filter((r) => !r.isCommon).reduce((s, r) => s + r.bill, 0);
  const commonLiability = detailed.filter((r) => r.isCommon).reduce((s, r) => s + r.bill, 0);
  const totalAdjustments = detailed.filter((r) => !r.isCommon).reduce((s, r) => s + (r.adj || 0), 0);

  return {
    rows: detailed,
    totalCons,
    rawCons,
    resCons,
    costItems,
    grandTotal,
    nRes,
    residentialBillTotal,
    commonLiability,
    totalAdjustments,
  };
}

function empty() {
  return { rows: [], totalCons: 1, rawCons: 0, resCons: 1, costItems: [], grandTotal: 0, nRes: 0, residentialBillTotal: 0, commonLiability: 0, totalAdjustments: 0 };
}
