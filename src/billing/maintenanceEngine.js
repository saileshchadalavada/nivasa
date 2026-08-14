/* Canonical maintenance billing engine — pure function, no React, no Firestore.
   Every maintenance calculation in the app MUST use this engine.
   Consumers: Dashboard, History, snapshot, poster, Broadcast.

   FIN-06 fix: maintenance surplus does NOT subtract corpus when corpus is
   billed as a separate line item. Surplus = maintenance collected - expenses.
   Corpus is tracked independently.
*/

/**
 * @param {Object} period          - Maintenance period document (expenses, chargePerFlat, carryForward)
 * @param {number} residentialCount - Number of residential (non-common) flats
 * @param {number} [corpusMonthly]  - Per-flat monthly corpus contribution (from building config)
 * @returns {Object} Canonical maintenance billing result
 */
export function computeMaint(period, residentialCount, corpusMonthly = 0) {
  const M = period;
  const nRes = residentialCount || 1;
  const exp = (M && M.expenses) || [];

  const totalExpense = exp.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Who paid what out of pocket
  const owedByFlat = {};
  exp.forEach((e) => {
    if (e.paidBy && e.paidBy !== "fund") {
      owedByFlat[e.paidBy] = (owedByFlat[e.paidBy] || 0) + Number(e.amount || 0);
    }
  });

  const calculatedPerFlat = nRes ? totalExpense / nRes : 0;
  const charge = (M && M.chargePerFlat != null && M.chargePerFlat !== "") ? Number(M.chargePerFlat) : null;
  const chargedPerFlat = charge != null ? charge : calculatedPerFlat;

  const corpusPerFlat = Number(corpusMonthly) || 0;

  // FIN-06: surplus = maintenance collections - maintenance expenses.
  // Corpus is billed separately and does NOT reduce maintenance surplus.
  const maintenanceCollected = charge != null ? charge * nRes : totalExpense;
  const maintenanceSurplus = charge != null ? (charge * nRes - totalExpense) : 0;

  const carryForward = Number((M && M.carryForward) || 0);

  return {
    totalExpense,
    calculatedPerFlat,
    chargedPerFlat,
    maintenanceCollected,
    maintenanceSurplus,
    carryForward,
    owedByFlat,
    corpusPerFlat,
    nRes,
    // Convenience aliases for backward compat with Dashboard consumers
    total: totalExpense,
    perFlat: chargedPerFlat,
    calculated: calculatedPerFlat,
    charge,
    surplus: maintenanceSurplus,
    byMember: owedByFlat,
    corpusMonthly: corpusPerFlat,
  };
}
