import {
  computeCostPerChickProducedFcfa,
  computeCostPerChickSoldFcfa,
  computeGrossMarginFcfa,
  computeProfitabilityRate,
  computeRevenueFcfa,
  computeTotalExpensesFcfa,
} from './broiler-finance.calculations';

describe('computeTotalExpensesFcfa', () => {
  it('additionne les montants de charges', () => {
    expect(computeTotalExpensesFcfa([500_000, 300_000, 50_000])).toBe(850_000);
  });

  it('retourne 0 pour une liste vide', () => {
    expect(computeTotalExpensesFcfa([])).toBe(0);
  });
});

describe('computeRevenueFcfa', () => {
  it('reproduit le scénario §25 : une vente nette de 1 800 000 FCFA -> CA 1 800 000 FCFA', () => {
    expect(computeRevenueFcfa([1_800_000])).toBe(1_800_000);
  });
});

describe('computeGrossMarginFcfa', () => {
  it('soustrait les charges du chiffre d’affaires', () => {
    expect(computeGrossMarginFcfa(1_800_000, 850_000)).toBe(950_000);
  });
});

describe('computeProfitabilityRate', () => {
  it('calcule la rentabilité en pourcentage', () => {
    expect(computeProfitabilityRate(950_000, 850_000)).toBeCloseTo(111.7647, 3);
  });

  it('retourne 0 si les charges sont nulles (jamais #DIV/0!)', () => {
    expect(computeProfitabilityRate(950_000, 0)).toBe(0);
  });
});

describe('computeCostPerChickProducedFcfa', () => {
  it('divise les charges totales par le nombre commercialisable', () => {
    expect(computeCostPerChickProducedFcfa(850_000, 950)).toBeCloseTo(894.7368, 3);
  });

  it('retourne 0 si aucun poulet commercialisable (jamais #DIV/0!)', () => {
    expect(computeCostPerChickProducedFcfa(850_000, 0)).toBe(0);
  });
});

describe('computeCostPerChickSoldFcfa', () => {
  it('divise les charges totales par le nombre vendu', () => {
    expect(computeCostPerChickSoldFcfa(850_000, 300)).toBeCloseTo(2833.333, 2);
  });

  it('retourne 0 si aucune vente (jamais #DIV/0!)', () => {
    expect(computeCostPerChickSoldFcfa(850_000, 0)).toBe(0);
  });
});
