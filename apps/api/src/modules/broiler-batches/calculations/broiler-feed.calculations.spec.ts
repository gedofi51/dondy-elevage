import {
  computeAverageConsumptionPerSubject,
  computeCumulativeFeedConsumption,
} from './broiler-feed.calculations';

describe('computeCumulativeFeedConsumption', () => {
  it('additionne les quantités distribuées', () => {
    expect(computeCumulativeFeedConsumption([50, 48, 52])).toBe(150);
  });

  it('retourne 0 pour une liste vide (aucune saisie)', () => {
    expect(computeCumulativeFeedConsumption([])).toBe(0);
  });
});

describe('computeAverageConsumptionPerSubject', () => {
  it('calcule la consommation moyenne par sujet', () => {
    expect(computeAverageConsumptionPerSubject(150, 1000)).toBeCloseTo(0.15);
  });

  it('retourne 0 si l’effectif moyen est nul (jamais #DIV/0!)', () => {
    expect(computeAverageConsumptionPerSubject(150, 0)).toBe(0);
  });
});
