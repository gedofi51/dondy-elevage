import { describe, expect, it } from 'vitest';
import { buildMonthGrid } from './attendance-calendar-grid';

describe('buildMonthGrid', () => {
  it('aligns the 1st of the month on the correct weekday (lundi = index 0)', () => {
    // Février 2026 commence un dimanche -> 6 cases vides avant le 1er.
    const grid = buildMonthGrid(2026, 1);
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6]).toBe('2026-02-01');
  });

  it('contains every day of the month, zero-padded, in order', () => {
    const grid = buildMonthGrid(2026, 1); // février 2026 : 28 jours (non bissextile)
    const days = grid.filter((d): d is string => d !== null);
    expect(days).toHaveLength(28);
    expect(days[0]).toBe('2026-02-01');
    expect(days[days.length - 1]).toBe('2026-02-28');
  });

  it('handles a leap February correctly (2028)', () => {
    const grid = buildMonthGrid(2028, 1);
    const days = grid.filter((d): d is string => d !== null);
    expect(days).toHaveLength(29);
    expect(days[days.length - 1]).toBe('2028-02-29');
  });

  it('always returns a multiple of 7 cells', () => {
    for (let month = 0; month < 12; month++) {
      expect(buildMonthGrid(2026, month).length % 7).toBe(0);
    }
  });

  it('pads single-digit months and days with a leading zero', () => {
    const grid = buildMonthGrid(2026, 8); // septembre 2026
    expect(grid.find((d) => d !== null)).toMatch(/^2026-09-0\d$/);
  });
});
