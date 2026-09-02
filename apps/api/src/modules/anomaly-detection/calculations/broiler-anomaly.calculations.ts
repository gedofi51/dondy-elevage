import { computeDailyMortalityRate } from '../../broiler-batches/calculations/broiler-headcount.calculations';
import {
  computeDeclineSignal,
  computeIncreaseSignal,
  type AnomalySignal,
} from './anomaly-signal.calculations';

/**
 * Détection d'anomalies — Poulets de chair (Lot 4). Règle CROISÉE (par
 * opposition aux alertes existantes — mortalité isolée d'un seul jour,
 * déjà couvertes par BroilerAlertsCronService.checkPreviousDayIssues) :
 * baisse eau ET baisse aliment ET hausse mortalité, simultanément, sur
 * RECENT_WINDOW_DAYS jours consécutifs SAISIS, comparés aux
 * BASELINE_WINDOW_DAYS jours consécutifs immédiatement précédents.
 *
 * Seuils calibrés (décision Lot 4, non tranchée par le porteur de projet
 * — même principe que la fenêtre 30j du Lot 2) : une baisse d'eau/aliment
 * en dessous de ces seuils reste dans la variabilité normale d'un
 * élevage ; le seuil mortalité (+50 % relatif) est volontairement plus
 * permissif que le seuil absolu de l'alerte isolée existante
 * (0,5 %/j) — cette règle détecte une TENDANCE relative, pas un pic
 * ponctuel déjà couvert ailleurs.
 */
export const RECENT_WINDOW_DAYS = 3;
export const BASELINE_WINDOW_DAYS = 3;
export const WATER_DECLINE_THRESHOLD_PERCENT = 15;
export const FEED_DECLINE_THRESHOLD_PERCENT = 10;
export const MORTALITY_INCREASE_THRESHOLD_PERCENT = 50;

export interface BroilerDailyRecordLike {
  dayNumber: number;
  operatorId: string | null;
  mortalityQuantity: number;
  feedDistributedKg: number | null;
  waterConsumptionLiters: number | null;
}

export type AnomalyDataStatus = 'SUFFISANT' | 'INSUFFISANT';

export interface BroilerAnomalyResult {
  dataStatus: AnomalyDataStatus;
  windowDays: number;
  /** [premier jour, dernier jour] de chaque fenêtre — `null` si
   * dataStatus = INSUFFISANT. */
  recentDayRange: [number, number] | null;
  baselineDayRange: [number, number] | null;
  /** `null` = mesure absente sur au moins un jour de la fenêtre (jamais
   * moyennée sur un jour non mesuré) — la règle ne peut alors pas se
   * déclencher, ce signal manque à la décomposition. */
  water: AnomalySignal | null;
  feed: AnomalySignal | null;
  mortality: AnomalySignal | null;
  triggered: boolean;
}

const INSUFFICIENT_RESULT: BroilerAnomalyResult = {
  dataStatus: 'INSUFFISANT',
  windowDays: RECENT_WINDOW_DAYS,
  recentDayRange: null,
  baselineDayRange: null,
  water: null,
  feed: null,
  mortality: null,
  triggered: false,
};

/**
 * Pure — aucun accès BDD (voir AnomalyDetectionCronService pour la
 * requête en amont : tous les BroilerDailyRecord de la bande).
 * `currentDayNumber` = jour du jour, le jour courant n'est jamais
 * évalué (peut légitimement ne pas encore être saisi), même précaution
 * que BroilerAlertsCronService.checkPreviousDayIssues.
 */
export function detectBroilerCrossSignalAnomaly(
  records: BroilerDailyRecordLike[],
  currentDayNumber: number,
  startedQuantity: number,
): BroilerAnomalyResult {
  const totalWindowDays = RECENT_WINDOW_DAYS + BASELINE_WINDOW_DAYS;
  const endDay = currentDayNumber - 1;
  const startDay = endDay - totalWindowDays + 1;
  if (startDay < 1) {
    return INSUFFICIENT_RESULT;
  }

  const byDayNumber = new Map(records.map((r) => [r.dayNumber, r]));
  const window: BroilerDailyRecordLike[] = [];
  for (let day = startDay; day <= endDay; day++) {
    const record = byDayNumber.get(day);
    if (!record || record.operatorId === null) {
      return INSUFFICIENT_RESULT;
    }
    window.push(record);
  }

  const baselineRecords = window.slice(0, BASELINE_WINDOW_DAYS);
  const recentRecords = window.slice(BASELINE_WINDOW_DAYS);

  const water = [...baselineRecords, ...recentRecords].every(
    (r) => r.waterConsumptionLiters != null,
  )
    ? computeDeclineSignal(
        'Eau',
        'L/j',
        recentRecords.map((r) => r.waterConsumptionLiters!),
        baselineRecords.map((r) => r.waterConsumptionLiters!),
        WATER_DECLINE_THRESHOLD_PERCENT,
      )
    : null;

  const feed = [...baselineRecords, ...recentRecords].every((r) => r.feedDistributedKg != null)
    ? computeDeclineSignal(
        'Aliment',
        'kg/j',
        recentRecords.map((r) => r.feedDistributedKg!),
        baselineRecords.map((r) => r.feedDistributedKg!),
        FEED_DECLINE_THRESHOLD_PERCENT,
      )
    : null;

  // Taux de mortalité approximé sur l'effectif démarré (même approximation
  // V1 documentée que BroilerAlertsCronService.checkPreviousDayIssues, pas
  // de recalcul jour par jour de l'effectif de début de journée exact).
  const toRates = (list: BroilerDailyRecordLike[]) =>
    list.map((r) => computeDailyMortalityRate(r.mortalityQuantity, startedQuantity));
  const mortality = computeIncreaseSignal(
    'Mortalité',
    '%/j',
    toRates(recentRecords),
    toRates(baselineRecords),
    MORTALITY_INCREASE_THRESHOLD_PERCENT,
  );

  const triggered =
    (water?.triggered ?? false) && (feed?.triggered ?? false) && mortality.triggered;

  return {
    dataStatus: 'SUFFISANT',
    windowDays: RECENT_WINDOW_DAYS,
    recentDayRange: [
      recentRecords[0]!.dayNumber,
      recentRecords[recentRecords.length - 1]!.dayNumber,
    ],
    baselineDayRange: [
      baselineRecords[0]!.dayNumber,
      baselineRecords[baselineRecords.length - 1]!.dayNumber,
    ],
    water,
    feed,
    mortality,
    triggered,
  };
}
