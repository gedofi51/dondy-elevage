import {
  computeWeightedScore,
  contributionFromRatePercent,
  contributionFromRatioToTarget,
  type BatchPerformanceScore,
  type PerformanceScoreCoefficients,
  type PerformanceScoreComponent,
} from '../../../common/calculations/performance-score.util';

// Ré-exporté : ce module de calcul reste le point d'entrée "score Chair"
// pour service/contrôleur, qui n'ont pas besoin de connaître
// common/calculations/performance-score.util directement pour ce type.
export type { BatchPerformanceScore };
import { computeFeedConversionRatio } from './broiler-growth.calculations';

/**
 * Score de performance — Poulets de chair (Lot 5, IA). 3 composantes :
 * mortalité cumulée (déjà exposée via `/:id/profitability`), IC (idem),
 * GMQ moyen sur tout le cycle (nouveau — dérivé de `finalAverageWeightG`/
 * `cycleDurationDays`, déjà présents dans `BatchClosureSummary`, PAS le
 * GMQ tendance du Lot 3 qui ne porte que sur les 2 dernières pesées).
 *
 * Aucune cible GMQ/IC par défaut n'est codée en dur ici : le cahier des
 * charges ne documente aucune valeur cible zootechnique (vérifié en
 * investigation, voir DETTE_TECHNIQUE.md Lot 5) — en inventer une serait
 * exactement le "chiffre inventé" que ce module s'interdit. Sans cible
 * configurée (`Setting`), la composante reste dans la décomposition avec
 * sa valeur brute mais une contribution `null` (exclue du score, jamais
 * remplacée par 0).
 */
export interface BroilerPerformanceScoreInput {
  cumulativeMortalityRate: number;
  finalAverageWeightG: number | null;
  totalFeedConsumptionKg: number;
  startedQuantity: number;
  cycleDurationDays: number;
}

/** Poids par défaut : répartition égale entre les 3 composantes tant
 * qu'aucun coefficient n'est configuré via `Setting` — le seul défaut
 * défendable sans hypothèse métier arbitraire (voir DETTE_TECHNIQUE.md). */
const DEFAULT_WEIGHT = 1 / 3;

export function buildBroilerPerformanceScore(
  input: BroilerPerformanceScoreInput,
  coefficients: PerformanceScoreCoefficients,
  now: Date = new Date(),
): BatchPerformanceScore {
  const hasWeighing = input.finalAverageWeightG !== null;
  const gmqGramsPerDay =
    hasWeighing && input.cycleDurationDays > 0
      ? input.finalAverageWeightG! / input.cycleDurationDays
      : null;
  const liveWeightGainKg = hasWeighing
    ? (input.finalAverageWeightG! * input.startedQuantity) / 1000
    : null;
  const feedConversionRatio =
    liveWeightGainKg !== null && liveWeightGainKg > 0
      ? computeFeedConversionRatio(input.totalFeedConsumptionKg, liveWeightGainKg)
      : null;

  const mortalityWeight = coefficients.mortality?.weight ?? DEFAULT_WEIGHT;
  const icWeight = coefficients.ic?.weight ?? DEFAULT_WEIGHT;
  const gmqWeight = coefficients.gmq?.weight ?? DEFAULT_WEIGHT;
  const icTarget = coefficients.ic?.target ?? null;
  const gmqTarget = coefficients.gmq?.target ?? null;

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
      key: 'ic',
      label: 'Indice de consommation (IC)',
      rawValue: feedConversionRatio,
      unit: '',
      target: icTarget,
      weight: icWeight,
      contributionPercent:
        feedConversionRatio !== null && icTarget !== null
          ? contributionFromRatioToTarget(feedConversionRatio, icTarget, 'LOWER_IS_BETTER')
          : null,
    },
    {
      key: 'gmq',
      label: 'GMQ moyen (cycle)',
      rawValue: gmqGramsPerDay,
      unit: 'g/j',
      target: gmqTarget,
      weight: gmqWeight,
      contributionPercent:
        gmqGramsPerDay !== null && gmqTarget !== null
          ? contributionFromRatioToTarget(gmqGramsPerDay, gmqTarget, 'HIGHER_IS_BETTER')
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
