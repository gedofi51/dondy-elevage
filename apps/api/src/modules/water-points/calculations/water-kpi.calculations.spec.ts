import {
  computeAvailabilityRatePercent,
  computeAverageConsumptionPerPointM3,
} from './water-kpi.calculations';

describe('computeAverageConsumptionPerPointM3', () => {
  it('calcule la moyenne sur plusieurs relevés', () => {
    expect(computeAverageConsumptionPerPointM3(24, 3)).toBe(8);
  });

  it('retourne 0 (jamais une erreur) quand aucun relevé', () => {
    expect(computeAverageConsumptionPerPointM3(0, 0)).toBe(0);
  });
});

describe('computeAvailabilityRatePercent', () => {
  it('calcule le taux de jours avec relevé sur une période', () => {
    expect(computeAvailabilityRatePercent(28, 30)).toBeCloseTo(93.33, 2);
  });

  it('retourne 100 quand un relevé existe chaque jour de la période', () => {
    expect(computeAvailabilityRatePercent(30, 30)).toBe(100);
  });

  it('retourne 0 quand la période a une durée nulle', () => {
    expect(computeAvailabilityRatePercent(0, 0)).toBe(0);
  });
});
