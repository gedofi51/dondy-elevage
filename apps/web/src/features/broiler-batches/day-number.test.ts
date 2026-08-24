import { describe, expect, it } from 'vitest';
import { DAILY_CYCLE_LENGTH, computeDayNumber, isDayNumberInCycle } from './day-number';

// `today` fixé à midi UTC (jamais près de minuit) pour rester indépendant
// du fuseau horaire de la machine qui exécute les tests — computeDayNumber
// reset les deux dates à minuit LOCAL avant de comparer, un instant proche
// de minuit UTC ferait basculer le jour calendaire local selon le fuseau.
describe('computeDayNumber', () => {
  it('returns 1 on the arrival date itself', () => {
    expect(computeDayNumber('2026-08-10', new Date('2026-08-10T12:00:00Z'))).toBe(1);
  });

  it('increments by 1 per elapsed calendar day', () => {
    expect(computeDayNumber('2026-08-10', new Date('2026-08-11T12:00:00Z'))).toBe(2);
  });

  it('reaches 45 exactly 44 days after arrival', () => {
    expect(computeDayNumber('2026-08-10', new Date('2026-09-23T12:00:00Z'))).toBe(45);
  });

  it('keeps counting past 45 (day 46+)', () => {
    expect(computeDayNumber('2026-08-10', new Date('2026-09-24T12:00:00Z'))).toBe(46);
  });

  it('returns a value below 1 before arrival (bande pas encore démarrée)', () => {
    expect(computeDayNumber('2026-08-10', new Date('2026-08-09T12:00:00Z'))).toBe(0);
  });
});

describe('isDayNumberInCycle', () => {
  it('is false before day 1', () => {
    expect(isDayNumberInCycle(0)).toBe(false);
  });

  it('is true from day 1 to day 45 inclusive', () => {
    expect(isDayNumberInCycle(1)).toBe(true);
    expect(isDayNumberInCycle(DAILY_CYCLE_LENGTH)).toBe(true);
  });

  it('is false once the cycle is over (46+)', () => {
    expect(isDayNumberInCycle(DAILY_CYCLE_LENGTH + 1)).toBe(false);
  });
});
