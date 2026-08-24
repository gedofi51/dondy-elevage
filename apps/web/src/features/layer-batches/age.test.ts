import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeCurrentAgeWeeks } from './age';

const NOW = new Date('2026-08-24T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('computeCurrentAgeWeeks', () => {
  it('returns the age at entry when the batch entered today', () => {
    expect(computeCurrentAgeWeeks(NOW.toISOString(), 20, 0)).toBe(20);
  });

  it('adds one full week per 7 elapsed days since entry', () => {
    const entryDate = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
    expect(computeCurrentAgeWeeks(entryDate, 0, 0)).toBe(1);
  });

  it('combines age-at-entry (weeks + days) with elapsed time, floored to whole weeks', () => {
    // 3 jours d'âge à l'entrée + 7 jours écoulés = 10 jours -> 1 semaine pleine.
    const entryDate = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
    expect(computeCurrentAgeWeeks(entryDate, 0, 3)).toBe(1);
  });

  it('treats null ageAtEntryWeeks/ageAtEntryDays as 0', () => {
    const entryDate = new Date(NOW.getTime() - 14 * 86_400_000).toISOString();
    expect(computeCurrentAgeWeeks(entryDate, null, null)).toBe(2);
  });

  it('never returns a negative elapsed contribution for a future entry date', () => {
    const entryDate = new Date(NOW.getTime() + 10 * 86_400_000).toISOString();
    expect(computeCurrentAgeWeeks(entryDate, 5, 0)).toBe(5);
  });
});
