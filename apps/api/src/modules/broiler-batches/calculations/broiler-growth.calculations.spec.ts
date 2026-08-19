import {
  computeAverageWeightG,
  computeFeedConversionRatio,
  computeGmqGramsPerDay,
} from './broiler-growth.calculations';

describe('computeAverageWeightG', () => {
  it('reproduit le scénario §25 : 10 poulets pour 12,4 kg -> 1,24 kg (1240 g)', () => {
    expect(computeAverageWeightG(12_400, 10)).toBe(1240);
  });

  it('retourne 0 si aucun animal pesé (jamais #DIV/0!)', () => {
    expect(computeAverageWeightG(12_400, 0)).toBe(0);
  });
});

describe('computeGmqGramsPerDay', () => {
  it('calcule le gain moyen quotidien entre deux pesées', () => {
    expect(computeGmqGramsPerDay(1240, 1100, 7)).toBeCloseTo(20);
  });

  it('retourne 0 si le nombre de jours est nul (jamais #DIV/0!)', () => {
    expect(computeGmqGramsPerDay(1240, 1100, 0)).toBe(0);
  });
});

describe('computeFeedConversionRatio', () => {
  it('calcule l’indice de consommation', () => {
    expect(computeFeedConversionRatio(150, 100)).toBeCloseTo(1.5);
  });

  it('retourne 0 si le gain de poids est nul (jamais #DIV/0!)', () => {
    expect(computeFeedConversionRatio(150, 0)).toBe(0);
  });
});
