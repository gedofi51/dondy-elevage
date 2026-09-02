import {
  computeGrossMarginFcfa,
  computeProfitabilityRate,
} from '../../broiler-batches/calculations/broiler-finance.calculations';

/**
 * Prévisions finance (Lot 3) — GET /treasury/previsions. Réutilise les
 * définitions RÉELLES de CA/charges/marge/rentabilité déjà établies en
 * Phase 8 (TreasuryService.getSummary, computeGrossMarginFcfa,
 * computeProfitabilityRate) — pas de nouvelle définition (prompt Lot 3,
 * interdiction explicite). Le "réalisé" de la réponse EST
 * TreasuryService.getSummary() calculé du début de période à aujourd'hui
 * (voir TreasuryService.getForecast) — pas une valeur recalculée ici.
 *
 * "Prévu" = extrapolation linéaire (règle de trois) du rythme observé sur
 * la partie déjà écoulée de la période vers la période entière — comparable
 * au "réalisé" sans qu'aucun des deux ne soit persistant : les deux sont
 * recalculés à chaque lecture (calculatedAt), pas de nouvelle table
 * (décision Lot 3, voir DETTE_TECHNIQUE.md — cohérent avec la philosophie
 * non-persistante des Lots 1/2). C'est là le "comparatif prévu/réalisé"
 * du prompt : réalisé à date vs projection fin de période, jamais "ce
 * qu'on avait prévu il y a N jours" (aucun historique conservé).
 *
 * Seuil de suffisance : sous MIN_DAYS_ELAPSED_FOR_FORECAST jours écoulés
 * dans le mois, une règle de trois amplifierait démesurément un rythme à
 * peine amorcé (prompt Lot 3 : "donnée insuffisante -> état explicite,
 * jamais un chiffre inventé").
 */
export const MIN_DAYS_ELAPSED_FOR_FORECAST = 3;

export type TreasuryForecastDataStatus = 'SUFFISANT' | 'INSUFFISANT';

export interface TreasuryForecastInput {
  periodStart: Date;
  periodEnd: Date;
  /** TreasurySummary calculé de periodStart à "now" (réalisé à date). */
  revenueToDateFcfa: number;
  totalExpensesToDateFcfa: number;
  netTreasuryToDateFcfa: number;
}

export interface TreasuryForecastProjection {
  revenueFcfa: number;
  totalExpensesFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
  /** Projection fin de période — négatif = besoin de trésorerie prévu. */
  netTreasuryFcfa: number;
}

export interface TreasuryForecast {
  periodStart: string;
  periodEnd: string;
  daysElapsed: number;
  daysTotal: number;
  dataStatus: TreasuryForecastDataStatus;
  realized: {
    revenueFcfa: number;
    totalExpensesFcfa: number;
    netTreasuryFcfa: number;
  };
  /** `null` tant que dataStatus = INSUFFISANT. */
  projected: TreasuryForecastProjection | null;
  calculatedAt: string;
}

function daysBetweenInclusive(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Pure — aucun accès BDD (voir TreasuryService.getForecast pour l'appel à
 * getSummary() en amont).
 */
export function buildTreasuryForecast(
  input: TreasuryForecastInput,
  now: Date = new Date(),
): TreasuryForecast {
  const daysTotal = daysBetweenInclusive(input.periodStart, input.periodEnd);
  const daysElapsed = Math.min(
    daysTotal,
    Math.max(1, daysBetweenInclusive(input.periodStart, now)),
  );

  const base = {
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    daysElapsed,
    daysTotal,
    realized: {
      revenueFcfa: input.revenueToDateFcfa,
      totalExpensesFcfa: input.totalExpensesToDateFcfa,
      netTreasuryFcfa: input.netTreasuryToDateFcfa,
    },
    calculatedAt: now.toISOString(),
  };

  if (daysElapsed < MIN_DAYS_ELAPSED_FOR_FORECAST) {
    return { ...base, dataStatus: 'INSUFFISANT', projected: null };
  }

  const runRate = daysTotal / daysElapsed;
  const revenueFcfa = Math.round(input.revenueToDateFcfa * runRate);
  const totalExpensesFcfa = Math.round(input.totalExpensesToDateFcfa * runRate);
  const grossMarginFcfa = computeGrossMarginFcfa(revenueFcfa, totalExpensesFcfa);

  return {
    ...base,
    dataStatus: 'SUFFISANT',
    projected: {
      revenueFcfa,
      totalExpensesFcfa,
      grossMarginFcfa,
      profitabilityRate: computeProfitabilityRate(grossMarginFcfa, totalExpensesFcfa),
      netTreasuryFcfa: Math.round(input.netTreasuryToDateFcfa * runRate),
    },
  };
}
