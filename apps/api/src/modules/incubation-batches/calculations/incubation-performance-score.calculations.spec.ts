import { buildIncubationPerformanceScore } from './incubation-performance-score.calculations';

const NOW = new Date('2026-09-03T08:00:00.000Z');

describe('buildIncubationPerformanceScore', () => {
  it('lot ECLOS : les 2 composantes contribuent, poids égaux par défaut', () => {
    const result = buildIncubationPerformanceScore(
      { hatchRatePercent: 78, fertilityRatePercent: 92 },
      {},
      NOW,
    );
    expect(result.scoreOn100).toBeCloseTo((78 + 92) / 2);
    expect(result.dataStatus).toBe('SUFFISANT');
  });

  it('lot EN_INCUBATION (pas encore éclos) : les 2 composantes sont null, score INSUFFISANT', () => {
    const result = buildIncubationPerformanceScore(
      { hatchRatePercent: null, fertilityRatePercent: null },
      {},
      NOW,
    );
    expect(result.scoreOn100).toBeNull();
    expect(result.dataStatus).toBe('INSUFFISANT');
    expect(result.components.every((c) => c.contributionPercent === null)).toBe(true);
  });

  it('coefficients personnalisés respectés', () => {
    const result = buildIncubationPerformanceScore(
      { hatchRatePercent: 80, fertilityRatePercent: 40 },
      { hatchRate: { weight: 0.9 }, fertilityRate: { weight: 0.1 } },
      NOW,
    );
    expect(result.scoreOn100).toBeCloseTo(80 * 0.9 + 40 * 0.1);
  });
});
