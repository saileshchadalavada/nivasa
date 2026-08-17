/* Canonical per-flat balance engine — pure function, no React, no Firestore.
   All Overview, FlatStatement, PerFlatPayments, Broadcast, and snapshot
   consumers must call computeBalance() for balance and status calculations.

   Accounting model:
     A. currentCharges     = water + maintenance + corpus + adjustments (always ≥ 0)
     B. previousOutstanding = unpaid closing balance from prior billing cycles
     C. paymentsThisCycle  = active (non-reversed) payments recorded for this cycle
     D. reimbursementApplied = association credit auto-applied against the bill
     E. reimbursementPending = remaining credit the association still owes the resident

   Key invariants:
     - currentCharges is NEVER negative (owedByFlat is NOT subtracted from it)
     - balanceDue and reimbursementPending cannot both be > 0 simultaneously
*/

const TOLERANCE = 0.01; // ₹0.01 — float-safe zero check

/**
 * Compute the canonical per-flat balance for one billing period.
 *
 * @param {object} params
 * @param {number} [params.waterCharge]      Current-period water bill for this flat
 * @param {number} [params.maintCharge]      Current-period maintenance per-flat share
 * @param {number} [params.corpusCharge]     Current-period corpus contribution
 * @param {number} [params.adjustments]      Admin-approved adjustments (positive = charge)
 * @param {number} [params.prevOutstanding]  Unpaid balance carried from prior periods
 * @param {number} [params.totalPaid]        Sum of active (non-reversed) payments this cycle
 * @param {number} [params.owedByFlat]       Amount association owes resident (expenses fronted)
 * @returns {{
 *   currentCharges: number,
 *   previousOutstanding: number,
 *   totalCharged: number,
 *   paymentsThisCycle: number,
 *   reimbursementApplied: number,
 *   reimbursementPending: number,
 *   balanceDue: number,
 *   status: "unpaid"|"partial"|"paid"|"reimbursement_pending"
 * }}
 */
export function computeBalance({
  waterCharge = 0,
  maintCharge = 0,
  corpusCharge = 0,
  adjustments = 0,
  prevOutstanding = 0,
  totalPaid = 0,
  owedByFlat = 0,
} = {}) {
  const currentCharges = waterCharge + maintCharge + corpusCharge + adjustments;
  const previousOutstanding = prevOutstanding;
  const totalCharged = currentCharges + previousOutstanding;
  const paymentsThisCycle = totalPaid;

  // Apply payments first; then apply reimbursement credit against the remainder.
  // Cap reimbursementApplied so it never exceeds the remaining balance.
  const afterPayments = Math.max(0, totalCharged - paymentsThisCycle);
  const reimbursementApplied = Math.min(owedByFlat, afterPayments);
  const reimbursementPending = Math.max(0, owedByFlat - reimbursementApplied);

  const balanceDue = Math.max(0, afterPayments - reimbursementApplied);

  let status;
  if (balanceDue <= TOLERANCE && reimbursementPending > TOLERANCE) {
    status = "reimbursement_pending";
  } else if (balanceDue <= TOLERANCE) {
    status = "paid";
  } else if (paymentsThisCycle > TOLERANCE) {
    status = "partial";
  } else {
    status = "unpaid";
  }

  return {
    currentCharges,
    previousOutstanding,
    totalCharged,
    paymentsThisCycle,
    reimbursementApplied,
    reimbursementPending,
    balanceDue,
    status,
  };
}
