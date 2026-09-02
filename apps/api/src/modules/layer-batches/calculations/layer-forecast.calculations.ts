import { computeLayingRatePercent } from './layer-eggs.calculations';

/**
 * Prévisions production (Lot 3) — GET /layer-batches/previsions. Contrairement
 * à BroilerBatch (cycle à durée fixe, projeté jusqu'à plannedSaleDate), la
 * ponte est continue : pas d'échéance naturelle, donc même patron que le
 * Lot 2 (items) — fenêtre glissante fixe de 30 jours, reportée telle
 * quelle en fenêtre de projection avant (§16, même rythme que la fenêtre
 * d'observation, lecture intuitive "les 30 prochains jours ressembleront
 * aux 30 derniers").
 *
 * Seuil de suffisance : au moins MIN_RECORD_DAYS_FOR_FORECAST journées
 * SAISIES dans la fenêtre — pas "avec au moins un mouvement" comme le
 * Lot 2 (LayerDailyRecord est créé à la demande, une journée sans ligne
 * est une journée non renseignée, pas juste sans ponte).
 *
 * Statuts projetables : voir LayerBatchesService.findAllForecast — REFORME/
 * CLOTURE/ANNULEE (cycle terminé) filtrés en amont, jamais ici.
 */
export const FORECAST_WINDOW_DAYS = 30;
export const MIN_RECORD_DAYS_FOR_FORECAST = 3;

export type LayerForecastDataStatus = 'SUFFISANT' | 'INSUFFISANT';

export interface LayerForecastInput {
  batchId: string;
  /** Somme de LayerDailyRecord.eggsLaid sur les FORECAST_WINDOW_DAYS
   * derniers jours — agrégation à la charge de l'appelant. */
  totalEggsLaidInWindow: number;
  /** Nombre de LayerDailyRecord dans la même fenêtre. */
  recordDaysInWindow: number;
  /** LayerBatchWithComputed.currentHeadcount — dernier effectif connu. */
  currentHeadcount: number;
}

export interface LayerForecast {
  batchId: string;
  windowDays: number;
  recordDaysInWindow: number;
  dataStatus: LayerForecastDataStatus;
  /** `null` tant que dataStatus = INSUFFISANT. */
  averageDailyEggs: number | null;
  projectedEggsNextWindow: number | null;
  projectedLayingRatePercent: number | null;
  /** ISO complet — voir prompt Lot 3, règle "chaque prévision horodatée". */
  calculatedAt: string;
}

/**
 * Pure — aucun accès BDD (voir LayerBatchesService.findAllForecast pour
 * l'agrégation SQL en amont).
 */
export function buildLayerForecast(
  input: LayerForecastInput,
  now: Date = new Date(),
): LayerForecast {
  const base = {
    batchId: input.batchId,
    windowDays: FORECAST_WINDOW_DAYS,
    recordDaysInWindow: input.recordDaysInWindow,
    calculatedAt: now.toISOString(),
  };

  const hasEnoughData =
    input.recordDaysInWindow >= MIN_RECORD_DAYS_FOR_FORECAST && input.currentHeadcount > 0;

  if (!hasEnoughData) {
    return {
      ...base,
      dataStatus: 'INSUFFISANT',
      averageDailyEggs: null,
      projectedEggsNextWindow: null,
      projectedLayingRatePercent: null,
    };
  }

  const averageDailyEggs = input.totalEggsLaidInWindow / FORECAST_WINDOW_DAYS;
  return {
    ...base,
    dataStatus: 'SUFFISANT',
    averageDailyEggs,
    projectedEggsNextWindow: Math.round(averageDailyEggs * FORECAST_WINDOW_DAYS),
    projectedLayingRatePercent: computeLayingRatePercent(averageDailyEggs, input.currentHeadcount),
  };
}
