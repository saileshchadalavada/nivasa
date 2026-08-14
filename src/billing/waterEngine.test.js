import { describe, expect, it } from 'vitest';
import { computeWater } from './waterEngine';

const makeFlats = (count) => {
  const flats = [];
  for (let i = 1; i <= count; i++) {
    flats.push({ flat: String(100 + i), name: `Flat ${100 + i}`, meter: '', isCommon: false, floor: 1, unit: i });
  }
  flats.push({ flat: 'Common', name: 'Watchman', meter: '', isCommon: true, floor: 0, unit: 0 });
  return flats;
};

describe('computeWater', () => {
  it('returns empty result for null period', () => {
    const result = computeWater(null, []);
    expect(result.rows).toEqual([]);
    expect(result.grandTotal).toBe(0);
  });

  it('calculates percentage split correctly', () => {
    const flats = makeFlats(2);
    const period = {
      costItems: [{ id: 'ci1', label: 'Tanker', quantity: 10, rate: 1000, split: 'percent' }],
      readings: {
        '101': { prev: 0, curr: 300, adj: 0 },
        '102': { prev: 0, curr: 700, adj: 0 },
        'Common': { prev: 0, curr: 0, adj: 0 },
      },
    };
    const result = computeWater(period, flats);
    expect(result.grandTotal).toBe(10000);
    const flat101 = result.rows.find((r) => r.flat === '101');
    const flat102 = result.rows.find((r) => r.flat === '102');
    expect(flat101.bill).toBeCloseTo(3000, 0);
    expect(flat102.bill).toBeCloseTo(7000, 0);
  });

  it('splits equal costs only among residential flats', () => {
    const flats = makeFlats(3);
    const period = {
      costItems: [{ id: 'ci1', label: 'Equal cost', quantity: 1, rate: 3000, split: 'equal' }],
      readings: {
        '101': { prev: 0, curr: 100, adj: 0 },
        '102': { prev: 0, curr: 100, adj: 0 },
        '103': { prev: 0, curr: 100, adj: 0 },
        'Common': { prev: 0, curr: 50, adj: 0 },
      },
    };
    const result = computeWater(period, flats);
    const common = result.rows.find((r) => r.isCommon);
    expect(common.bill).toBe(0);
    const flat101 = result.rows.find((r) => r.flat === '101');
    expect(flat101.bill).toBeCloseTo(1000, 0);
  });

  it('synthesizes legacy fields when costItems is empty', () => {
    const flats = makeFlats(2);
    const period = {
      genCount: 5, genRate: 1000, manCount: 2, manRate: 500, connBill: 200,
      readings: {
        '101': { prev: 0, curr: 500, adj: 0 },
        '102': { prev: 0, curr: 500, adj: 0 },
        'Common': { prev: 0, curr: 0, adj: 0 },
      },
    };
    const result = computeWater(period, flats);
    expect(result.grandTotal).toBe(5000 + 1000 + 200);
    expect(result.costItems).toHaveLength(3);
  });

  it('reports common liability separately from residential total', () => {
    const flats = makeFlats(2);
    const period = {
      costItems: [{ id: 'ci1', label: 'Tanker', quantity: 1, rate: 1000, split: 'percent' }],
      readings: {
        '101': { prev: 0, curr: 400, adj: 0 },
        '102': { prev: 0, curr: 400, adj: 0 },
        'Common': { prev: 0, curr: 200, adj: 0 },
      },
    };
    const result = computeWater(period, flats);
    expect(result.commonLiability).toBeCloseTo(200, 0);
    expect(result.residentialBillTotal).toBeCloseTo(800, 0);
    expect(result.residentialBillTotal + result.commonLiability).toBeCloseTo(result.grandTotal, 0);
  });

  it('applies adjustments to residential flats only', () => {
    const flats = makeFlats(1);
    const period = {
      costItems: [{ id: 'ci1', label: 'Cost', quantity: 1, rate: 1000, split: 'percent' }],
      readings: {
        '101': { prev: 0, curr: 1000, adj: -50 },
        'Common': { prev: 0, curr: 0, adj: 0 },
      },
    };
    const result = computeWater(period, flats);
    const flat101 = result.rows.find((r) => r.flat === '101');
    expect(flat101.bill).toBeCloseTo(950, 0);
  });

  it('handles zero consumption without dividing by zero', () => {
    const flats = makeFlats(2);
    const period = {
      costItems: [{ id: 'ci1', label: 'Cost', quantity: 1, rate: 1000, split: 'percent' }],
      readings: {
        '101': { prev: 100, curr: 100, adj: 0 },
        '102': { prev: 200, curr: 200, adj: 0 },
        'Common': { prev: 0, curr: 0, adj: 0 },
      },
    };
    const result = computeWater(period, flats);
    expect(result.rawCons).toBe(0);
    expect(isFinite(result.rows[0].pct)).toBe(true);
  });
});
