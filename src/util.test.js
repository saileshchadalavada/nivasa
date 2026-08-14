import { describe, expect, it } from 'vitest';
import { daysBetween, toMillis, money, labelFromStart, fmtDate } from './util';

describe('daysBetween', () => {
  it('counts both start and end dates', () => {
    expect(daysBetween('2026-06-01', '2026-06-30')).toBe(30);
  });
  it('counts a single day as one', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(1);
  });
  it('returns null for reversed range', () => {
    expect(daysBetween('2026-06-02', '2026-06-01')).toBeNull();
  });
  it('returns null for missing dates', () => {
    expect(daysBetween('', '2026-06-01')).toBeNull();
    expect(daysBetween('2026-06-01', '')).toBeNull();
    expect(daysBetween(null, null)).toBeNull();
  });
});

describe('toMillis', () => {
  it('returns numeric ms as-is', () => {
    expect(toMillis(1700000000000)).toBe(1700000000000);
  });
  it('handles Firestore Timestamp objects', () => {
    const ts = { toMillis: () => 1700000000000 };
    expect(toMillis(ts)).toBe(1700000000000);
  });
  it('handles Date objects', () => {
    const d = new Date('2026-06-01T00:00:00Z');
    expect(toMillis(d)).toBe(d.getTime());
  });
  it('handles ISO strings', () => {
    const ms = toMillis('2026-06-01');
    expect(ms).toBeGreaterThan(0);
  });
  it('returns NaN for null/undefined', () => {
    expect(toMillis(null)).toBeNaN();
    expect(toMillis(undefined)).toBeNaN();
  });
});

describe('money', () => {
  it('formats rupees with Indian locale', () => {
    expect(money(1500)).toBe('₹1,500');
  });
  it('handles zero', () => {
    expect(money(0)).toBe('₹0');
  });
});

describe('labelFromStart', () => {
  it('extracts month label from ISO date', () => {
    expect(labelFromStart('2026-06-06')).toBe('Jun 2026');
  });
  it('returns empty for missing input', () => {
    expect(labelFromStart('')).toBe('');
  });
});

describe('fmtDate', () => {
  it('formats ISO date', () => {
    expect(fmtDate('2026-06-06')).toBe('06 Jun 2026');
  });
  it('returns dash for missing input', () => {
    expect(fmtDate('')).toBe('—');
  });
});
