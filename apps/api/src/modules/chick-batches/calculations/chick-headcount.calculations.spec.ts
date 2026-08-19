import { computeChickCurrentHeadcount } from './chick-headcount.calculations';

describe('computeChickCurrentHeadcount', () => {
  it('soustrait le cumul vendu de la quantité initiale', () => {
    expect(computeChickCurrentHeadcount(30, 20)).toBe(10);
  });

  it('retourne la quantité initiale sans vente', () => {
    expect(computeChickCurrentHeadcount(30, 0)).toBe(30);
  });
});
