import { computeNextDueDate } from './next-due-date.calculations';

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

describe('computeNextDueDate', () => {
  it('ajoute la périodicité en jours à la date d’ancrage', () => {
    expect(computeNextDueDate(utc(2026, 1, 1), 90)).toEqual(utc(2026, 4, 1));
  });

  it('franchit correctement une année bissextile (2028)', () => {
    // 1er janvier 2028 + 60 jours = 1er mars 2028 (2028 est bissextile, 29 février inclus).
    expect(computeNextDueDate(utc(2028, 1, 1), 60)).toEqual(utc(2028, 3, 1));
  });

  it('gère une périodicité de 1 jour', () => {
    expect(computeNextDueDate(utc(2026, 6, 30), 1)).toEqual(utc(2026, 7, 1));
  });

  it('rejette une périodicité nulle ou négative', () => {
    expect(() => computeNextDueDate(utc(2026, 1, 1), 0)).toThrow();
    expect(() => computeNextDueDate(utc(2026, 1, 1), -5)).toThrow();
  });
});
