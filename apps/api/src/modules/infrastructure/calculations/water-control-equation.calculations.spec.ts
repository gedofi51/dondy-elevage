import { computeWaterControlGapM3 } from './water-control-equation.calculations';

describe('computeWaterControlGapM3', () => {
  it('calcule le gap normal (produite - consommation ferme - vendue)', () => {
    expect(computeWaterControlGapM3(100, 20, 70)).toBe(10);
  });

  it('retourne null si pumpedVolumeM3 est absent (équation non calculable)', () => {
    expect(computeWaterControlGapM3(null, 20, 70)).toBeNull();
  });

  it('traite une consommation interne absente comme 0', () => {
    expect(computeWaterControlGapM3(100, null, 70)).toBe(30);
  });

  it('gère un gap négatif (plus vendu/consommé que produit)', () => {
    expect(computeWaterControlGapM3(50, 20, 40)).toBe(-10);
  });
});
