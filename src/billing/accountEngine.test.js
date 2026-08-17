import { describe, expect, it } from 'vitest';
import { computeBalance } from './accountEngine';

describe('computeBalance (accountEngine)', () => {
  // 1. No payment
  it('1. no payment → balanceDue equals full bill, status unpaid', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200 });
    expect(r.currentCharges).toBe(2100);
    expect(r.totalCharged).toBe(2100);
    expect(r.balanceDue).toBe(2100);
    expect(r.status).toBe('unpaid');
  });

  // 2. First partial payment
  it('2. partial payment → remaining balance, status partial', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 400 });
    expect(r.paymentsThisCycle).toBe(400);
    expect(r.balanceDue).toBe(1700);
    expect(r.status).toBe('partial');
  });

  // 3. Two payments summed by caller
  it('3. two payments summed → balance 1000, status partial', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 1100 });
    expect(r.balanceDue).toBe(1000);
    expect(r.status).toBe('partial');
  });

  // 4. Full payment
  it('4. full payment → balance 0, status paid', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 2100 });
    expect(r.balanceDue).toBe(0);
    expect(r.status).toBe('paid');
  });

  // 5. Previous outstanding added to totalCharged
  it('5. prevOutstanding adds to totalCharged', () => {
    const r = computeBalance({ waterCharge: 1000, maintCharge: 1200, prevOutstanding: 1000 });
    expect(r.totalCharged).toBe(3200);
    expect(r.balanceDue).toBe(3200);
    expect(r.status).toBe('unpaid');
  });

  // 6. Payment spans previous and current
  it('6. 1500 paid against 3200 total → balance 1700, partial', () => {
    const r = computeBalance({ waterCharge: 1000, maintCharge: 1200, prevOutstanding: 1000, totalPaid: 1500 });
    expect(r.totalCharged).toBe(3200);
    expect(r.balanceDue).toBe(1700);
    expect(r.status).toBe('partial');
  });

  // 7. Reversed payment: caller passes totalPaid=0 after reversal
  it('7. caller excludes reversed payments → balance unchanged', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 0 });
    expect(r.balanceDue).toBe(2100);
    expect(r.status).toBe('unpaid');
  });

  // 8. Zero balance shows paid, never "₹0 back"
  it('8. zero balance and zero reimbursement → status paid (no "₹0 back")', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 2100 });
    expect(r.balanceDue).toBe(0);
    expect(r.reimbursementPending).toBe(0);
    expect(r.status).toBe('paid');
  });

  // 9. Reimbursement smaller than bill: partial credit applied, no pending
  it('9. owedByFlat 500 < bill 2100 → applied 500, balance 1600, no pending', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, owedByFlat: 500 });
    expect(r.reimbursementApplied).toBe(500);
    expect(r.balanceDue).toBe(1600);
    expect(r.reimbursementPending).toBe(0);
    expect(r.status).toBe('unpaid');
  });

  // 10. Reimbursement equal to bill: clears bill, no pending
  it('10. owedByFlat 2100 == bill 2100 → applied 2100, balance 0, status paid', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, owedByFlat: 2100 });
    expect(r.reimbursementApplied).toBe(2100);
    expect(r.balanceDue).toBe(0);
    expect(r.reimbursementPending).toBe(0);
    expect(r.status).toBe('paid');
  });

  // 11. Reimbursement larger than bill: clears bill, pending is the surplus
  it('11. owedByFlat 4590 > bill 2100 → applied 2100, balance 0, pending 2490', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, owedByFlat: 4590 });
    expect(r.reimbursementApplied).toBe(2100);
    expect(r.balanceDue).toBe(0);
    expect(r.reimbursementPending).toBe(2490);
    expect(r.status).toBe('reimbursement_pending');
  });

  // 12. Partial payment + reimbursement together clear the bill
  it('12. bill 2100, reimbursement 500, payment 1600 → fully paid', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, owedByFlat: 500, totalPaid: 1600 });
    expect(r.balanceDue).toBe(0);
    expect(r.reimbursementPending).toBe(0);
    expect(r.status).toBe('paid');
  });

  // 13. Zero owedByFlat means standard bill (reversed reimbursement)
  it('13. owedByFlat 0 → no reimbursement, standard balance', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, owedByFlat: 0 });
    expect(r.currentCharges).toBe(2100);
    expect(r.reimbursementApplied).toBe(0);
    expect(r.reimbursementPending).toBe(0);
    expect(r.balanceDue).toBe(2100);
  });

  // 14. prevOutstanding is included in totalCharged exactly once
  it('14. prevOutstanding applied once in totalCharged', () => {
    const r = computeBalance({ waterCharge: 1000, maintCharge: 1200, prevOutstanding: 500, totalPaid: 1700 });
    expect(r.totalCharged).toBe(2700);
    expect(r.balanceDue).toBe(1000);
  });

  // 15. Pure function: same inputs always produce identical outputs
  it('15. pure function: repeated calls with same inputs yield identical results', () => {
    const inputs = { waterCharge: 1000, maintCharge: 1200, prevOutstanding: 500 };
    const a = computeBalance(inputs);
    const b = computeBalance(inputs);
    expect(a).toEqual(b);
    expect(a.totalCharged).toBe(2700);
  });

  // 16. Historic payments excluded (caller passes only cycle payments)
  it('16. totalPaid=0 when caller excludes prior-cycle payments', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 0 });
    expect(r.balanceDue).toBe(2100);
  });

  // 17. Legacy full-payment migration treated as paid
  it('17. migrated full payment → status paid, balanceDue 0', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 2100 });
    expect(r.status).toBe('paid');
    expect(r.balanceDue).toBe(0);
  });

  // 18. Payment counted exactly once — no double-counting
  it('18. payment applied once; balanceDue = max(0, totalCharged - totalPaid)', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, totalPaid: 2100 });
    expect(r.paymentsThisCycle).toBe(2100);
    expect(r.balanceDue).toBe(0);
  });

  // Extra: corpus charge
  it('corpus charge adds to currentCharges', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, corpusCharge: 200 });
    expect(r.currentCharges).toBe(2300);
    expect(r.balanceDue).toBe(2300);
  });

  // Extra: currentCharges is never negative even when owedByFlat is large
  it('currentCharges never goes negative regardless of owedByFlat', () => {
    const r = computeBalance({ waterCharge: 900, maintCharge: 1200, owedByFlat: 99999 });
    expect(r.currentCharges).toBe(2100);
    expect(r.currentCharges).toBeGreaterThanOrEqual(0);
  });

  // Extra: balanceDue and reimbursementPending cannot both be > 0
  it('balanceDue and reimbursementPending are mutually exclusive (not both > 0)', () => {
    const cases = [
      { waterCharge: 900, maintCharge: 1200, owedByFlat: 4590 },
      { waterCharge: 900, maintCharge: 1200, owedByFlat: 500 },
      { waterCharge: 1000, maintCharge: 1200, prevOutstanding: 500, totalPaid: 500 },
    ];
    for (const c of cases) {
      const r = computeBalance(c);
      const bothPositive = r.balanceDue > 0.01 && r.reimbursementPending > 0.01;
      expect(bothPositive).toBe(false);
    }
  });
});
