import {
  computeWeightedScore,
  contributionFromRatePercent,
  type BatchPerformanceScore,
  type PerformanceScoreCoefficients,
  type PerformanceScoreComponent,
} from '../../../common/calculations/performance-score.util';

export type { BatchPerformanceScore };

/**
 * Score de performance — Pondeuses (Lot 5, IA). 2 composantes, toutes deux
 * déjà des taux 0-100 naturels (pas de "cible" à configurer, contrairement
 * à l'IC/GMQ Chair) : taux de ponte et mortalité cumulée (celle-ci
 * nouvellement exposée ce lot, voir layer-batches.service.ts).
 *
 * `daysTracked` gate UNIQUEMENT le taux de ponte : un lot encore en
 * `ELEVAGE` (avant le début de ponte) a `averageLayingRatePercent = 0` par
 * construction (aucune journée saisie) — un 0 % qui refléterait "pas
 * encore pertinent", pas "mauvaise performance". La mortalité reste
 * toujours calculable (0 décès constaté est une donnée réelle, pas une
 * valeur par défaut inventée).
 */
export interface LayerPerformanceScoreInput {
  cumulativeMortalityRate: number;
  averageLayingRatePercent: number;
  daysTracked: number;
}

const DEFAULT_WEIGHT = 1 / 2;

export function buildLayerPerformanceScore(
  input: LayerPerformanceScoreInput,
  coefficients: PerformanceScoreCoefficients,
  now: Date = new Date(),
): BatchPerformanceScore {
  const mortalityWeight = coefficients.mortality?.weight ?? DEFAULT_WEIGHT;
  const layingRateWeight = coefficients.layingRate?.weight ?? DEFAULT_WEIGHT;

  const hasLayingData = input.daysTracked > 0;

  const components: PerformanceScoreComponent[] = [
    {
      key: 'mortality',
      label: 'Taux de mortalité cumulé',
      rawValue: input.cumulativeMortalityRate,
      unit: '%',
      target: null,
      weight: mortalityWeight,
      contributionPercent: contributionFromRatePercent(
        input.cumulativeMortalityRate,
        'LOWER_IS_BETTER',
      ),
    },
    {
      key: 'layingRate',
      label: 'Taux de ponte moyen',
      rawValue: hasLayingData ? input.averageLayingRatePercent : null,
      unit: '%',
      target: null,
      weight: layingRateWeight,
      contributionPercent: hasLayingData
        ? contributionFromRatePercent(input.averageLayingRatePercent, 'HIGHER_IS_BETTER')
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
