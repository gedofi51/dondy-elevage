import { describe, expect, it } from 'vitest';
import { computePartCostPreviewFcfa, computePartsCostPreviewFcfa } from './intervention-cost-preview';

describe('computePartCostPreviewFcfa', () => {
  it('multiplie la quantité par le coût moyen et arrondit', () => {
    expect(computePartCostPreviewFcfa(2, 5000)).toBe(10_000);
  });

  it('arrondit une quantité fractionnaire', () => {
    expect(computePartCostPreviewFcfa(1.5, 3333)).toBe(5000); // 4999.5 -> 5000
  });
});

describe('computePartsCostPreviewFcfa', () => {
  it('additionne le coût de plusieurs lignes', () => {
    expect(
      computePartsCostPreviewFcfa([
        { quantity: 2, averageUnitCostFcfa: 5000 },
        { quantity: 1, averageUnitCostFcfa: 12_000 },
      ]),
    ).toBe(22_000);
  });

  it('retourne 0 pour une liste vide', () => {
    expect(computePartsCostPreviewFcfa([])).toBe(0);
  });
});
