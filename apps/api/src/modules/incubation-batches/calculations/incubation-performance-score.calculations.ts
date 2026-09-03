import {
  computeWeightedScore,
  contributionFromRatePercent,
  type BatchPerformanceScore,
  type PerformanceScoreCoefficients,
  type PerformanceScoreComponent,
} from '../../../common/calculations/performance-score.util';

export type { BatchPerformanceScore };

/**
 * Score de performance — Couvoir (Lot 5, IA). 2 composantes, toutes deux
 * des taux 0-100 naturels (pas de cible à configurer) : taux d'éclosion et
 * taux de fécondité. `null` avant l'éclosion (`chicksHatched` non
 * renseigné) — même restriction "ECLOS uniquement" que la Comparaison Lot
 * 4, propagée depuis IncubationBatchesService.getProfitability().
 */
export interface IncubationPerformanceScoreInput {
  hatchRatePercent: number | null;
  fertilityRatePercent: number | null;
}

const DEFAULT_WEIGHT = 1 / 2;

export function buildIncubationPerformanceScore(
  input: IncubationPerformanceScoreInput,
  coefficients: PerformanceScoreCoefficients,
  now: Date = new Date(),
): BatchPerformanceScore {
  const hatchWeight = coefficients.hatchRate?.weight ?? DEFAULT_WEIGHT;
  const fertilityWeight = coefficients.fertilityRate?.weight ?? DEFAULT_WEIGHT;

  const components: PerformanceScoreComponent[] = [
    {
      key: 'hatchRate',
      label: "Taux d'éclosion",
      rawValue: input.hatchRatePercent,
      unit: '%',
      target: null,
      weight: hatchWeight,
      contributionPercent:
        input.hatchRatePercent !== null
          ? contributionFromRatePercent(input.hatchRatePercent, 'HIGHER_IS_BETTER')
          : null,
    },
    {
      key: 'fertilityRate',
      label: 'Taux de fécondité',
      rawValue: input.fertilityRatePercent,
      unit: '%',
      target: null,
      weight: fertilityWeight,
      contributionPercent:
        input.fertilityRatePercent !== null
          ? contributionFromRatePercent(input.fertilityRatePercent, 'HIGHER_IS_BETTER')
          : null,
    },
  ];

  const scoreOn100 = computeWeightedScore(
    components.map((c) => ({
      key: c.key,
      weight: c.weight,
      contributionPercent: c.contributionPercent,
    })),
  );

  return {
    scoreOn100,
    dataStatus: scoreOn100 !== null ? 'SUFFISANT' : 'INSUFFISANT',
    components,
    calculatedAt: now.toISOString(),
  };
}
