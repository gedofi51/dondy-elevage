import {
  computeEmbryonicMortalityRatePercent,
  computeFertileEggs,
  computeFertilityRatePercent,
  computeHatchRatePercent,
  computeInfectedRatePercent,
} from './incubation-kpi.calculations';

describe('computeFertileEggs', () => {
  it('soustrait les non-fécondés des œufs incubés (scénario §16-D)', () => {
    expect(computeFertileEggs(1050, 130)).toBe(920);
  });
});

describe('computeHatchRatePercent', () => {
  it('calcule le taux d’éclosion du scénario §16-D', () => {
    expect(computeHatchRatePercent(850, 1050)).toBeCloseTo(80.95, 2);
  });

  it('retourne 0 (jamais une erreur) quand aucun œuf incubé', () => {
    expect(computeHatchRatePercent(850, 0)).toBe(0);
  });
});

describe('computeFertilityRatePercent', () => {
  it('calcule le taux de fécondité du scénario §16-D', () => {
    expect(computeFertilityRatePercent(920, 1050)).toBeCloseTo(87.62, 2);
  });

  it('retourne 0 quand aucun œuf incubé', () => {
    expect(computeFertilityRatePercent(920, 0)).toBe(0);
  });
});

describe('computeEmbryonicMortalityRatePercent', () => {
  it('calcule le taux de mortalité embryonnaire du scénario §16-D', () => {
    expect(computeEmbryonicMortalityRatePercent(50, 920)).toBeCloseTo(5.43, 2);
  });

  it('retourne 0 quand aucun œuf fécondé', () => {
    expect(computeEmbryonicMortalityRatePercent(50, 0)).toBe(0);
  });
});

describe('computeInfectedRatePercent', () => {
  it('calcule le taux d’œufs infectés du scénario §16-D', () => {
    expect(computeInfectedRatePercent(20, 1050)).toBeCloseTo(1.9, 2);
  });

  it('retourne 0 quand aucun œuf incubé', () => {
    expect(computeInfectedRatePercent(20, 0)).toBe(0);
  });
});
