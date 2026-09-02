import { safeDivide } from '../../../common/calculations/safe-math.util';
import { computeGmqGramsPerDay } from './broiler-growth.calculations';

/**
 * Prévisions production (Lot 3) — GET /broiler-batches/previsions. Projette
 * la fin de cycle (jusqu'à plannedSaleDate) à partir de la TENDANCE
 * observée à date, jamais un chiffre inventé (prompt Lot 3, règle non
 * négociable). Deux volets indépendants — mortalité/effectif vendable
 * d'un côté, poids de l'autre — chacun son propre dataStatus plutôt qu'un
 * seul état bloquant les deux : un lot peut avoir une mortalité déjà
 * mesurable sans encore avoir de pesée (les pesées ne démarrent pas J1),
 * ou l'inverse.
 *
 * Seuil de suffisance mortalité : même principe que
 * MIN_MOVEMENT_DAYS_FOR_FORECAST (Lot 2, stock-forecast.calculations.ts)
 * — un minimum de jours écoulés depuis l'arrivée avant d'extrapoler un
 * taux journalier, sinon un seul jour anormal (ex. un pic de mortalité à
 * l'arrivée) pèserait sur toute la projection.
 *
 * Statuts projetables : voir BroilerBatchesService.findAllForecast — un
 * lot BROUILLON/PLANIFIEE (pas encore démarré) ou VENDUE/CLOTUREE/ANNULEE
 * (cycle terminé) n'a pas de trajectoire future à projeter, filtré en
 * amont, jamais ici (fonction pure, aucune notion de statut).
 */
export const MIN_ELAPSED_DAYS_FOR_MORTALITY_FORECAST = 3;

export type ForecastDataStatus = 'SUFFISANT' | 'INSUFFISANT';

export interface BroilerWeighing {
  dayNumber: number;
  averageWeightG: number;
}

export interface BroilerForecastInput {
  batchId: string;
  arrivalDate: Date;
  plannedSaleDate: Date;
  startedQuantity: number;
  /** BroilerBatchWithComputed.currentHeadcount — effectif vivant à date. */
  currentHeadcount: number;
  /** Somme de BroilerDailyRecord.mortalityQuantity sur tout le cycle à
   * date (agrégation à la charge de l'appelant). */
  cumulativeMortality: number;
  /** Les 2 dernières pesées (dayNumber le plus grand en premier), ou
   * `null` s'il en manque une — recherche à la charge de l'appelant
   * (BroilerDailyRecord.averageWeightG non null, ORDER BY dayNumber DESC
   * LIMIT 2 — dayNumber, pas date : immuable, contrairement à date qui
   * peut être corrigée rétroactivement avec arrivalDate). */
  latestWeighing: BroilerWeighing | null;
  previousWeighing: BroilerWeighing | null;
}

export interface BroilerForecast {
  batchId: string;
  /** ISO — période de référence de la projection : de l'arrivée à la
   * vente prévue (prompt Lot 3, règle "chaque prévision affiche sa
   * période de référence"). */
  referenceStart: string;
  referenceEnd: string;
  elapsedDays: number;
  remainingDays: number;
  mortalityDataStatus: ForecastDataStatus;
  /** `null` tant que mortalityDataStatus = INSUFFISANT. */
  projectedAdditionalMortality: number | null;
  projectedSellableCount: number | null;
  weightDataStatus: ForecastDataStatus;
  /** `null` tant que weightDataStatus = INSUFFISANT. */
  gmqTrendGramsPerDay: number | null;
  projectedFinalWeightG: number | null;
  calculatedAt: string;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Pure — aucun accès BDD (voir BroilerBatchesService.findAllForecast pour
 * l'agrégation en amont).
 */
export function buildBroilerForecast(
  input: BroilerForecastInput,
  now: Date = new Date(),
): BroilerForecast {
  const elapsedDays = Math.max(0, daysBetween(input.arrivalDate, now));
  const remainingDays = Math.max(0, daysBetween(now, input.plannedSaleDate));

  const base = {
    batchId: input.batchId,
    referenceStart: input.arrivalDate.toISOString(),
    referenceEnd: input.plannedSaleDate.toISOString(),
    elapsedDays,
    remainingDays,
    calculatedAt: now.toISOString(),
  };

  const mortalityDataStatus: ForecastDataStatus =
    elapsedDays >= MIN_ELAPSED_DAYS_FOR_MORTALITY_FORECAST ? 'SUFFISANT' : 'INSUFFISANT';
  let projectedAdditionalMortality: number | null = null;
  let projectedSellableCount: number | null = null;
  if (mortalityDataStatus === 'SUFFISANT') {
    const dailyMortalityRate = safeDivide(input.cumulativeMortality, elapsedDays);
    projectedAdditionalMortality = Math.round(dailyMortalityRate * remainingDays);
    projectedSellableCount = Math.max(0, input.currentHeadcount - projectedAdditionalMortality);
  }

  const weightDataStatus: ForecastDataStatus =
    input.latestWeighing && input.previousWeighing ? 'SUFFISANT' : 'INSUFFISANT';
  let gmqTrendGramsPerDay: number | null = null;
  let projectedFinalWeightG: number | null = null;
  if (weightDataStatus === 'SUFFISANT' && input.latestWeighing && input.previousWeighing) {
    gmqTrendGramsPerDay = computeGmqGramsPerDay(
      input.latestWeighing.averageWeightG,
      input.previousWeighing.averageWeightG,
      input.latestWeighing.dayNumber - input.previousWeighing.dayNumber,
    );
    projectedFinalWeightG = Math.max(
      0,
      Math.round(input.latestWeighing.averageWeightG + gmqTrendGramsPerDay * remainingDays),
    );
  }

  return {
    ...base,
    mortalityDataStatus,
    projectedAdditionalMortality,
    projectedSellableCount,
    weightDataStatus,
    gmqTrendGramsPerDay,
    projectedFinalWeightG,
  };
}
