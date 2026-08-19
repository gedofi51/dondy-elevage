import {
  computeHeadcountDelta,
  computeLayerCurrentHeadcount,
  computeSuggestedHenCount,
} from './layer-headcount.calculations';

describe('computeSuggestedHenCount', () => {
  it('soustrait les sorties de la veille à l’effectif de la veille', () => {
    expect(computeSuggestedHenCount(1000, 2, 1, 0)).toBe(997);
  });

  it('ne descend jamais artificiellement sous zéro (laissé tel quel, contrôle métier en amont)', () => {
    expect(computeSuggestedHenCount(1, 5, 0, 0)).toBe(-4);
  });
});

describe('computeHeadcountDelta', () => {
  it('retourne 0 quand la valeur saisie confirme la suggestion', () => {
    expect(computeHeadcountDelta(997, 997)).toBe(0);
  });

  it('retourne l’écart signé (recomptage physique différent de la suggestion)', () => {
    expect(computeHeadcountDelta(997, 995)).toBe(-2);
    expect(computeHeadcountDelta(997, 999)).toBe(2);
  });
});

describe('computeLayerCurrentHeadcount', () => {
  it('soustrait le cumul des sorties à l’effectif initial', () => {
    expect(computeLayerCurrentHeadcount(1000, 5, 2, 1)).toBe(992);
  });

  it('retourne l’effectif initial quand aucune sortie n’a été enregistrée', () => {
    expect(computeLayerCurrentHeadcount(1000, 0, 0, 0)).toBe(1000);
  });
});
