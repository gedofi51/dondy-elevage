import {
  buildBroilerPerformanceScore,
  type BroilerPerformanceScoreInput,
} from './broiler-performance-score.calculations';

const NOW = new Date('2026-09-03T08:00:00.000Z');

function makeInput(
  overrides: Partial<BroilerPerformanceScoreInput> = {},
): BroilerPerformanceScoreInput {
  return {
    cumulativeMortalityRate: 3,
    finalAverageWeightG: 1800,
    totalFeedConsumptionKg: 3000,
    startedQuantity: 1000,
    cycleDurationDays: 40,
    ...overrides,
  };
}

describe('buildBroilerPerformanceScore', () => {
  it('sans aucun coefficient configuré : poids égaux (1/3), mortalité seule calculable (aucune cible IC/GMQ)', () => {
    const result = buildBroilerPerformanceScore(makeInput(), {}, NOW);
    const mortality = result.components.find((c) => c.key === 'mortality')!;
    const ic = result.components.find((c) => c.key === 'ic')!;
    const gmq = result.components.find((c) => c.key === 'gmq')!;

    expect(mortality.contributionPercent).toBe(97); // 100 - 3
    expect(mortality.weight).toBeCloseTo(1 / 3);
    // IC/GMQ ont une valeur brute (weighing présent) mais aucune cible -> contribution null
    expect(ic.rawValue).not.toBeNull();
    expect(ic.contributionPercent).toBeNull();
    expect(gmq.rawValue).toBeCloseTo(1800 / 40);
    expect(gmq.contributionPercent).toBeNull();

    // Score = seule la mortalité contribue (renormalisation à son propre poids)
    expect(result.scoreOn100).toBeCloseTo(97);
    expect(result.dataStatus).toBe('SUFFISANT');
  });

  it('avec cibles IC/GMQ configurées : les 3 composantes contribuent', () => {
    const result = buildBroilerPerformanceScore(
      makeInput(),
      {
        mortality: { weight: 0.4 },
        ic: { weight: 0.3, target: 1.7 },
        gmq: { weight: 0.3, target: 45 },
      },
      NOW,
    );
    const ic = result.components.find((c) => c.key === 'ic')!;
    const gmq = result.components.find((c) => c.key === 'gmq')!;
    expect(ic.contributionPercent).not.toBeNull();
    expect(gmq.contributionPercent).not.toBeNull();
    expect(result.scoreOn100).not.toBeNull();
    expect(result.dataStatus).toBe('SUFFISANT');
  });

  it('aucune pesée saisie : IC et GMQ non calculables (valeur brute et contribution null, jamais 0 inventé)', () => {
    const result = buildBroilerPerformanceScore(
      makeInput({ finalAverageWeightG: null }),
      { ic: { weight: 0.3, target: 1.7 }, gmq: { weight: 0.3, target: 45 } },
      NOW,
    );
    const ic = result.components.find((c) => c.key === 'ic')!;
    const gmq = result.components.find((c) => c.key === 'gmq')!;
    expect(ic.rawValue).toBeNull();
    expect(ic.contributionPercent).toBeNull();
    expect(gmq.rawValue).toBeNull();
    expect(gmq.contributionPercent).toBeNull();
    // La mortalité seule reste calculable.
    expect(result.dataStatus).toBe('SUFFISANT');
  });

  it('bande fraîchement démarrée sans aucune consommation ni pesée : IC/GMQ null, mortalité à 0 % -> score = 100', () => {
    const result = buildBroilerPerformanceScore(
      makeInput({
        cumulativeMortalityRate: 0,
        finalAverageWeightG: null,
        totalFeedConsumptionKg: 0,
      }),
      {},
      NOW,
    );
    expect(result.scoreOn100).toBeCloseTo(100);
    expect(result.dataStatus).toBe('SUFFISANT');
  });

  it('horodatage de calcul explicite (ISO complet)', () => {
    const result = buildBroilerPerformanceScore(makeInput(), {}, NOW);
    expect(result.calculatedAt).toBe(NOW.toISOString());
  });
});
