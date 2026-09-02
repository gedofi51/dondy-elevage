import { computeDailyMortalityRate } from '../../broiler-batches/calculations/broiler-headcount.calculations';
import {
  computeDeclineSignal,
  computeIncreaseSignal,
  type AnomalySignal,
} from './anomaly-signal.calculations';
import {
  BASELINE_WINDOW_DAYS,
  FEED_DECLINE_THRESHOLD_PERCENT,
  MORTALITY_INCREASE_THRESHOLD_PERCENT,
  RECENT_WINDOW_DAYS,
} from './broiler-anomaly.calculations';

/**
 * Détection d'anomalies — Pondeuses (Lot 4). Règle à 2 signaux seulement
 * (baisse aliment ET hausse mortalité) — contrairement au Poulet de
 * chair, `LayerDailyRecord` n'a AUCUN champ eau (vérifié en investigation,
 * voir DETTE_TECHNIQUE.md) : l'eau n'est suivie qu'au niveau `WaterPoint`,
 * pas rattachée à un lot précis. Fenêtres/seuils réutilisés tels quels
 * (mêmes constantes que Broiler, `broiler-anomaly.calculations.ts`) —
 * même calibration, un seul jeu de seuils à faire évoluer.
 *
 * Contrairement à Broiler (jours consécutifs pré-générés, un jour non
 * saisi = ligne présente avec operatorId null), LayerDailyRecord est créé
 * À LA DEMANDE — l'ABSENCE de ligne est le signal "non saisi" (voir
 * DailyRecordsService). La fenêtre se définit donc sur les N dernières
 * lignes EXISTANTES, pas sur N dates calendaires consécutives — un
 * "presque tous les jours" reste évaluable, contrairement à Broiler.
 */
export interface LayerDailyRecordLike {
  date: Date;
  henCount: number;
  mortalityQuantity: number;
  feedDistributedKg: number | null;
}

export type AnomalyDataStatus = 'SUFFISANT' | 'INSUFFISANT';

export interface LayerAnomalyResult {
  dataStatus: AnomalyDataStatus;
  windowDays: number;
  /** ISO `yyyy-mm-dd` — `null` si dataStatus = INSUFFISANT. */
  recentDateRange: [string, string] | null;
  baselineDateRange: [string, string] | null;
  /** `null` = aliment non mesuré sur au moins un jour de la fenêtre. */
  feed: AnomalySignal | null;
  mortality: AnomalySignal | null;
  triggered: boolean;
}

const INSUFFICIENT_RESULT: LayerAnomalyResult = {
  dataStatus: 'INSUFFISANT',
  windowDays: RECENT_WINDOW_DAYS,
  recentDateRange: null,
  baselineDateRange: null,
  feed: null,
  mortality: null,
  triggered: false,
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pure — aucun accès BDD. `recordsDesc` = les LayerDailyRecord du lot,
 * ANTÉRIEURS au jour courant (voir AnomalyDetectionCronService), triés
 * par date DÉCROISSANTE (le plus récent en premier) — au moins
 * RECENT_WINDOW_DAYS + BASELINE_WINDOW_DAYS lignes requises.
 */
export function detectLayerCrossSignalAnomaly(
  recordsDesc: LayerDailyRecordLike[],
): LayerAnomalyResult {
  const totalWindowDays = RECENT_WINDOW_DAYS + BASELINE_WINDOW_DAYS;
  if (recordsDesc.length < totalWindowDays) {
    return INSUFFICIENT_RESULT;
  }

  const recentRecords = recordsDesc.slice(0, RECENT_WINDOW_DAYS).slice().reverse();
  const baselineRecords = recordsDesc.slice(RECENT_WINDOW_DAYS, totalWindowDays).slice().reverse();

  const feed = [...baselineRecords, ...recentRecords].every((r) => r.feedDistributedKg != null)
    ? computeDeclineSignal(
        'Aliment',
        'kg/j',
        recentRecords.map((r) => r.feedDistributedKg!),
        baselineRecords.map((r) => r.feedDistributedKg!),
        FEED_DECLINE_THRESHOLD_PERCENT,
      )
    : null;

  // henCount PERSISTÉ par journée (contrairement à l'approximation
  // startedQuantity côté Broiler) -> taux journalier exact, pas une
  // approximation.
  const toRates = (list: LayerDailyRecordLike[]) =>
    list.map((r) => computeDailyMortalityRate(r.mortalityQuantity, r.henCount));
  const mortality = computeIncreaseSignal(
    'Mortalité',
    '%/j',
    toRates(recentRecords),
    toRates(baselineRecords),
    MORTALITY_INCREASE_THRESHOLD_PERCENT,
  );

  const triggered = (feed?.triggered ?? false) && mortality.triggered;

  return {
    dataStatus: 'SUFFISANT',
    windowDays: RECENT_WINDOW_DAYS,
    recentDateRange: [
      isoDate(recentRecords[0]!.date),
      isoDate(recentRecords[recentRecords.length - 1]!.date),
    ],
    baselineDateRange: [
      isoDate(baselineRecords[0]!.date),
      isoDate(baselineRecords[baselineRecords.length - 1]!.date),
    ],
    feed,
    mortality,
    triggered,
  };
}
