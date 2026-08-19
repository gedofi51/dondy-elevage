import {
  computeCumulativeMortalityRate,
  computeDailyMortalityRate,
  computeRemainingHeadcount,
  computeStartedQuantity,
} from './broiler-headcount.calculations';

describe('computeStartedQuantity', () => {
  it('soustrait les morts à l’arrivée du nombre reçu', () => {
    expect(computeStartedQuantity(1000, 3)).toBe(997);
  });

  it('gère zéro mort à l’arrivée', () => {
    expect(computeStartedQuantity(1000, 0)).toBe(1000);
  });
});

describe('computeRemainingHeadcount', () => {
  it('applique l’équation fondamentale §17 (initial - mortalité - réformes - autres sorties - ventes)', () => {
    const remaining = computeRemainingHeadcount({
      startedQuantity: 1000,
      cumulativeMortality: 3,
      cumulativeCulls: 2,
      cumulativeOtherExits: 0,
      cumulativeConfirmedSold: 300,
    });
    expect(remaining).toBe(695);
  });

  it('reproduit le scénario §25 : 950 commercialisables, vente de 300 -> 650 disponibles', () => {
    const remaining = computeRemainingHeadcount({
      startedQuantity: 950,
      cumulativeMortality: 0,
      cumulativeCulls: 0,
      cumulativeOtherExits: 0,
      cumulativeConfirmedSold: 300,
    });
    expect(remaining).toBe(650);
  });

  it('reproduit l’exemple §10.5 en trois ventes cumulées : 950 -> 0 disponible', () => {
    const remaining = computeRemainingHeadcount({
      startedQuantity: 950,
      cumulativeMortality: 0,
      cumulativeCulls: 0,
      cumulativeOtherExits: 0,
      cumulativeConfirmedSold: 300 + 250 + 400,
    });
    expect(remaining).toBe(0);
  });
});

describe('computeDailyMortalityRate', () => {
  it('calcule le taux journalier en pourcentage', () => {
    expect(computeDailyMortalityRate(3, 1000)).toBeCloseTo(0.3);
  });

  it('retourne 0 (jamais une erreur) si l’effectif de début de journée est nul', () => {
    expect(computeDailyMortalityRate(3, 0)).toBe(0);
  });
});

describe('computeCumulativeMortalityRate', () => {
  it('reproduit le scénario §25 : 3 morts sur 1000 -> 0,3 %', () => {
    expect(computeCumulativeMortalityRate(3, 1000)).toBeCloseTo(0.3);
  });

  it('retourne 0 si l’effectif initial est nul (jamais #DIV/0!)', () => {
    expect(computeCumulativeMortalityRate(3, 0)).toBe(0);
  });
});
