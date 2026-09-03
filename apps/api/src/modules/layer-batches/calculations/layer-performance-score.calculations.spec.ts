import { buildLayerPerformanceScore } from './layer-performance-score.calculations';

const NOW = new Date('2026-09-03T08:00:00.000Z');

describe('buildLayerPerformanceScore', () => {
  it('poids égaux (1/2) par défaut, les 2 composantes contribuent quand la ponte a démarré', () => {
    const result = buildLayerPerformanceScore(
      { cumulativeMortalityRate: 2, averageLayingRatePercent: 85, daysTracked: 20 },
      {},
      NOW,
    );
    const mortality = result.components.find((c) => c.key === 'mortality')!;
    const layingRate = result.components.find((c) => c.key === 'layingRate')!;

    expect(mortality.weight).toBeCloseTo(0.5);
    expect(mortality.contributionPercent).toBe(98);
    expect(layingRate.contributionPercent).toBe(85);
    expect(result.scoreOn100).toBeCloseTo((98 + 85) / 2);
    expect(result.dataStatus).toBe('SUFFISANT');
  });

  it('lot en ELEVAGE (daysTracked = 0) : taux de ponte exclu (pas 0 % inventé), score = mortalité seule', () => {
    const result = buildLayerPerformanceScore(
      { cumulativeMortalityRate: 0, averageLayingRatePercent: 0, daysTracked: 0 },
      {},
      NOW,
    );
    const layingRate = result.components.find((c) => c.key === 'layingRate')!;
    expect(layingRate.rawValue).toBeNull();
    expect(layingRate.contributionPercent).toBeNull();
    expect(result.scoreOn100).toBeCloseTo(100); // mortalité 0 % -> contribution 100, seule composante
    expect(result.dataStatus).toBe('SUFFISANT');
  });

  it('coefficients personnalisés respectés', () => {
    const result = buildLayerPerformanceScore(
      { cumulativeMortalityRate: 10, averageLayingRatePercent: 60, daysTracked: 10 },
      { mortality: { weight: 0.8 }, layingRate: { weight: 0.2 } },
      NOW,
    );
    // (90*0.8 + 60*0.2) / 1 = 84
    expect(result.scoreOn100).toBeCloseTo(84);
  });
});
