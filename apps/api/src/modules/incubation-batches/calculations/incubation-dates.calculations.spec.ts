import { computeExpectedCandlingDate, computeExpectedHatchDate } from './incubation-dates.calculations';

describe('computeExpectedHatchDate', () => {
  it('ajoute la durée d’incubation (défaut 21 jours) à la date de mise en incubation', () => {
    const start = new Date('2026-08-01T00:00:00.000Z');
    const result = computeExpectedHatchDate(start, 21);
    expect(result.toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });
});

describe('computeExpectedCandlingDate', () => {
  it('ajoute le décalage de mirage (défaut 7 jours) à la date de mise en incubation', () => {
    const start = new Date('2026-08-01T00:00:00.000Z');
    const result = computeExpectedCandlingDate(start, 7);
    expect(result.toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });
});
