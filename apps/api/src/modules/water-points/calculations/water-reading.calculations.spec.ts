import {
  computeConsumptionM3,
  computeSalesCashGapFcfa,
  computeTheoreticalAmountFcfa,
  computeVarianceFcfa,
} from './water-reading.calculations';

describe('computeConsumptionM3', () => {
  it('calcule la consommation du scénario §16-E (120 -> 128 = 8 m³)', () => {
    expect(computeConsumptionM3(128, 120)).toBe(8);
  });

  it('retourne 0 quand index soir = index matin (aucune consommation)', () => {
    expect(computeConsumptionM3(120, 120)).toBe(0);
  });
});

describe('computeTheoreticalAmountFcfa', () => {
  it('applique le tarif au scénario §16-E (8 m³ x 2500 FCFA/m³)', () => {
    expect(computeTheoreticalAmountFcfa(8, 2500)).toBe(20_000);
  });

  it('retourne 0 pour une consommation nulle', () => {
    expect(computeTheoreticalAmountFcfa(0, 2500)).toBe(0);
  });
});

describe('computeVarianceFcfa', () => {
  it('détecte un écart positif (encaissé > théorique)', () => {
    expect(computeVarianceFcfa(21_000, 20_000)).toBe(1_000);
  });

  it('détecte un écart négatif (encaissé < théorique)', () => {
    expect(computeVarianceFcfa(19_500, 20_000)).toBe(-500);
  });

  it('retourne 0 quand encaissé = théorique (scénario §16-E sans écart)', () => {
    expect(computeVarianceFcfa(20_000, 20_000)).toBe(0);
  });
});

describe('computeSalesCashGapFcfa', () => {
  it('détecte un écart entre caisse du relevé et ventes Sale(EAU) loguées', () => {
    expect(computeSalesCashGapFcfa(20_000, 15_000)).toBe(5_000);
  });

  it('retourne 0 quand les deux flux concordent exactement', () => {
    expect(computeSalesCashGapFcfa(20_000, 20_000)).toBe(0);
  });

  it('retourne 0 quand aucune vente Sale(EAU) n’a été loguée pour ce point/jour', () => {
    expect(computeSalesCashGapFcfa(20_000, 0)).toBe(20_000);
  });
});
