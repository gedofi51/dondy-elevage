import { computeStockAutonomyDays, type StockStatus } from './stock-status.calculations';

/**
 * Prévisions stocks (Lot 2) — STOCKS.md : "Calculer l'autonomie lorsque
 * cela est pertinent." `computeStockAutonomyDays` (ci-dessus) existait déjà,
 * testée mais jamais câblée à un endpoint — réutilisée telle quelle,
 * uniquement quand une consommation moyenne réellement déterminée existe
 * (voir `buildItemForecast`, jamais 0 jour = "indéterminé").
 *
 * Fenêtre glissante fixe de 30 jours (ni proratisée sur l'âge de
 * l'article, ni variable) : simple à expliquer/auditer, toujours reportée
 * explicitement dans la réponse (`windowDays`) — voir prompt Lot 2, règle
 * "chaque prévision affiche sa période de référence". Seuil de
 * suffisance : au moins 3 dates de sortie distinctes dans la fenêtre,
 * sinon `dataStatus: 'INSUFFISANT'` (jamais un chiffre inventé).
 *
 * Les sorties `AJUSTEMENT` (correction d'inventaire, pas une consommation
 * réelle) sont exclues de l'agrégation en amont (voir
 * ItemsService.findAllForecast) — toutes les autres raisons SORTIE
 * (DISTRIBUTION_BANDE/VENTE/PERTE/CASSE/CONSOMMATION_INTERNE/MAINTENANCE)
 * comptent comme consommation réelle.
 */
export const FORECAST_WINDOW_DAYS = 30;
export const MIN_MOVEMENT_DAYS_FOR_FORECAST = 3;
/** Cible de couverture pour la suggestion de réapprovisionnement basée sur
 * la consommation — même longueur que la fenêtre d'observation, pour une
 * lecture intuitive ("reconstituer pour couvrir encore autant de jours
 * qu'observés"). */
export const REORDER_TARGET_COVERAGE_DAYS = 30;

export type ForecastDataStatus = 'SUFFISANT' | 'INSUFFISANT';
export type ReorderBasis = 'CONSOMMATION' | 'SEUIL_MINIMUM';

export interface ItemForecastInput {
  itemId: string;
  currentStock: number;
  minThreshold: number | null;
  status: StockStatus;
  /** Somme des quantités SORTIE (hors AJUSTEMENT) sur les
   * FORECAST_WINDOW_DAYS derniers jours — déjà agrégée en SQL. */
  totalSortieInWindow: number;
  /** Nombre de dates distinctes ayant au moins une sortie (hors
   * AJUSTEMENT) dans la même fenêtre — mesure la densité réelle de
   * données, pas seulement leur somme. */
  movementDaysInWindow: number;
}

export interface ItemForecast {
  itemId: string;
  status: StockStatus;
  dataStatus: ForecastDataStatus;
  windowDays: number;
  movementDaysInWindow: number;
  /** Unité/jour — `null` tant que dataStatus = INSUFFISANT. */
  averageDailyConsumption: number | null;
  autonomyDays: number | null;
  /** ISO `yyyy-mm-dd` — `null` tant que dataStatus = INSUFFISANT. */
  estimatedStockoutDate: string | null;
  suggestedReorderQuantity: number | null;
  reorderBasis: ReorderBasis | null;
  /** ISO complet — voir prompt Lot 2 : "chaque prévision affiche sa date
   * de calcul". Même valeur pour toute une réponse (voir
   * ItemsService.findAllForecast), pas recalculée par article. */
  calculatedAt: string;
}

function roundUpToThousandth(value: number): number {
  return Math.ceil(value * 1000) / 1000;
}

function addDaysIso(from: Date, days: number): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Seul repli possible sans consommation déterminée : dérivé d'un champ
 * réel déjà saisi par l'utilisateur (minThreshold), jamais une valeur
 * inventée — voir prompt Lot 2, règle "données insuffisantes -> état
 * explicite, jamais un chiffre inventé". `null` si aucun seuil défini ou
 * si le stock actuel n'est déjà pas sous ce seuil (rien à suggérer). */
function thresholdReorderSuggestion(
  currentStock: number,
  minThreshold: number | null,
): { quantity: number; basis: ReorderBasis } | null {
  if (minThreshold === null || currentStock >= minThreshold) {
    return null;
  }
  return { quantity: roundUpToThousandth(minThreshold - currentStock), basis: 'SEUIL_MINIMUM' };
}

/**
 * Pure — aucun accès BDD (voir ItemsService.findAllForecast pour
 * l'agrégation SQL en amont : SUM/COUNT DISTINCT sur la fenêtre glissante).
 */
export function buildItemForecast(input: ItemForecastInput, now: Date = new Date()): ItemForecast {
  const base = {
    itemId: input.itemId,
    status: input.status,
    windowDays: FORECAST_WINDOW_DAYS,
    movementDaysInWindow: input.movementDaysInWindow,
    calculatedAt: now.toISOString(),
  };

  const hasEnoughData =
    input.movementDaysInWindow >= MIN_MOVEMENT_DAYS_FOR_FORECAST && input.totalSortieInWindow > 0;

  if (!hasEnoughData) {
    const fallback = thresholdReorderSuggestion(input.currentStock, input.minThreshold);
    return {
      ...base,
      dataStatus: 'INSUFFISANT',
      averageDailyConsumption: null,
      autonomyDays: null,
      estimatedStockoutDate: null,
      suggestedReorderQuantity: fallback?.quantity ?? null,
      reorderBasis: fallback?.basis ?? null,
    };
  }

  const averageDailyConsumption = input.totalSortieInWindow / FORECAST_WINDOW_DAYS;
  const autonomyDays = Math.floor(
    computeStockAutonomyDays(input.currentStock, averageDailyConsumption),
  );
  const estimatedStockoutDate = addDaysIso(now, autonomyDays);

  const targetStock = averageDailyConsumption * REORDER_TARGET_COVERAGE_DAYS;
  const consumptionSuggestion = targetStock - input.currentStock;
  const suggestedReorderQuantity =
    consumptionSuggestion > 0 ? roundUpToThousandth(consumptionSuggestion) : null;

  return {
    ...base,
    dataStatus: 'SUFFISANT',
    averageDailyConsumption,
    autonomyDays,
    estimatedStockoutDate,
    suggestedReorderQuantity,
    reorderBasis: suggestedReorderQuantity !== null ? 'CONSOMMATION' : null,
  };
}
