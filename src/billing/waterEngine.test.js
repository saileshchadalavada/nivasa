import { describe, expect, it } from 'vitest';
import { daysBetween } from '../util';

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
});