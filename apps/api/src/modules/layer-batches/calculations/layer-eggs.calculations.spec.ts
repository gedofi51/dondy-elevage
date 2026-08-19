import { computeEggsSellable, computeLayingRatePercent } from './layer-eggs.calculations';

describe('computeEggsSellable', () => {
  it('soustrait cassés et rejetés du total pondu', () => {
    expect(computeEggsSellable(950, 20, 10)).toBe(920);
  });

  it('gère un cas sans perte', () => {
    expect(computeEggsSellable(500, 0, 0)).toBe(500);
  });
});

describe('computeLayingRatePercent', () => {
  it('calcule le taux de ponte du scénario §16-B (950/1000)', () => {
    expect(computeLayingRatePercent(950, 1000)).toBeCloseTo(95, 5);
  });

  it('retourne 0 (jamais une erreur) quand aucune poule n’est présente', () => {
    expect(computeLayingRatePercent(950, 0)).toBe(0);
  });

  it('retourne 0 quand le nombre de poules est non fini', () => {
    expect(computeLayingRatePercent(950, NaN)).toBe(0);
  });
});
