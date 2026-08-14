import { describe, expect, it } from 'vitest';
import { computeMaint } from './maintenanceEngine';

describe('computeMaint', () => {
  it('returns zero for empty period', () => {
    const result = computeMaint(null, 15);
    expect(result.totalExpense).toBe(0);
    expect(result.chargedPerFlat).toBe(0);
  });

  it('calculates equal split across flats', () => {
    const period = {
      expenses: [
        { id: 'e1', item: 'Watchman', amount: 7500, paidBy: 'fund' },
        { id: 'e2', item: 'Power', amount: 2500, paidBy: 'fund' },
      ],
    };
    const result = computeMaint(period, 10);
    expect(result.totalExpense).toBe(10000);
    expect(result.calculatedPerFlat).toBe(1000);
    expect(result.chargedPerFlat).toBe(1000);
  });

  it('uses chargePerFlat when set', () => {
    const period = {
      expenses: [{ id: 'e1', item: 'Watchman', amount: 7500, paidBy: 'fund' }],
      chargePerFlat: 1000,
    };
    const result = computeMaint(period, 10);
    expect(result.chargedPerFlat).toBe(1000);
    expect(result.calculatedPerFlat).toBe(750);
  });

  it('calculates surplus without subtracting corpus (FIN-06)', () => {
    const period = {
      expenses: [{ id: 'e1', item: 'Watchman', amount: 5000, paidBy: 'fund' }],
      chargePerFlat: 1000,
    };
    const corpusMonthly = 200;
    const result = computeMaint(period, 10, corpusMonthly);
    // surplus = (1000 * 10) - 5000 = 5000 (corpus NOT subtracted)
    expect(result.maintenanceSurplus).toBe(5000);
    expect(result.corpusPerFlat).toBe(200);
  });

  it('tracks member-paid expenses as owed-back', () => {
    const period = {
      expenses: [
        { id: 'e1', item: 'Repair', amount: 500, paidBy: '301' },
        { id: 'e2', item: 'Watchman', amount: 7500, paidBy: 'fund' },
      ],
    };
    const result = computeMaint(period, 15);
    expect(result.owedByFlat['301']).toBe(500);
    expect(result.owedByFlat['fund']).toBeUndefined();
  });

  it('handles carry-forward', () => {
    const period = {
      expenses: [],
      carryForward: 1500,
    };
    const result = computeMaint(period, 10);
    expect(result.carryForward).toBe(1500);
  });

  it('provides backward-compatible aliases', () => {
    const period = {
      expenses: [{ id: 'e1', item: 'Test', amount: 3000, paidBy: 'fund' }],
      chargePerFlat: 500,
    };
    const result = computeMaint(period, 10);
    expect(result.total).toBe(result.totalExpense);
    expect(result.perFlat).toBe(result.chargedPerFlat);
    expect(result.calculated).toBe(result.calculatedPerFlat);
    expect(result.byMember).toBe(result.owedByFlat);
    expect(result.surplus).toBe(result.maintenanceSurplus);
  });
});
