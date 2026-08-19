import { computeCostPerEggFcfa } from './layer-finance.calculations';

describe('computeCostPerEggFcfa', () => {
  it('calcule le coût par œuf du scénario §16-B (143000/2740)', () => {
    expect(computeCostPerEggFcfa(143_000, 2740)).toBeCloseTo(52.19, 2);
  });

  it('retourne 0 (jamais une erreur) quand aucun œuf commercialisable', () => {
    expect(computeCostPerEggFcfa(143_000, 0)).toBe(0);
  });
});
