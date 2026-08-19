import { computeLotRemaining } from './egg-stock-lot.calculations';

describe('computeLotRemaining', () => {
  it('retourne la quantité produite sans mouvement', () => {
    expect(computeLotRemaining(920, [])).toBe(920);
  });

  it('soustrait une sortie vente', () => {
    expect(computeLotRemaining(920, [{ type: 'SORTIE_VENTE', quantity: 920 }])).toBe(0);
  });

  it('soustrait plusieurs types de sortie (vente + perte)', () => {
    expect(
      computeLotRemaining(910, [
        { type: 'SORTIE_VENTE', quantity: 580 },
        { type: 'PERTE_CASSE', quantity: 10 },
      ]),
    ).toBe(320);
  });

  it('restaure la quantité via ENTREE_ANNULATION sans jamais supprimer la sortie d’origine', () => {
    expect(
      computeLotRemaining(920, [
        { type: 'SORTIE_VENTE', quantity: 920 },
        { type: 'ENTREE_ANNULATION', quantity: 920 },
      ]),
    ).toBe(920);
  });
});
