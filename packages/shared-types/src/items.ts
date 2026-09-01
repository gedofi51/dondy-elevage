export type StockStatus = 'VERT' | 'ORANGE' | 'ROUGE';

/** `currentStock`/`minThreshold` sont des `Decimal` Prisma sérialisés en
 * chaîne (voir WaterPoint.initialIndex). `status` calculé côté service à
 * chaque lecture (jamais stocké), toujours présent dans la réponse. */
export interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  minThreshold: string | null;
  currentStock: string;
  averageUnitCostFcfa: number;
  supplierId: string | null;
  status: StockStatus;
}

/** currentStock/averageUnitCostFcfa volontairement absents : écrits
 * exclusivement par StockMovementsService.recordMovementInTransaction,
 * jamais via ce DTO (voir stock-movements.ts). */
export interface CreateItemInput {
  name: string;
  category: string;
  unit: string;
  minThreshold?: number;
  supplierId?: string;
}

export interface UpdateItemInput {
  name?: string;
  category?: string;
  unit?: string;
  minThreshold?: number;
  supplierId?: string;
}

/**
 * Prévisions stocks (Lot 2, `GET /items/previsions`) — STOCKS.md :
 * "Calculer l'autonomie lorsque cela est pertinent." Champs prévisionnels
 * (`averageDailyConsumption`/`autonomyDays`/`estimatedStockoutDate`/
 * `suggestedReorderQuantity`) volontairement séparés des champs réels
 * (`currentStock`/`status` sur `Item`) — jamais mélangés visuellement côté
 * UI (voir ItemForecastTable). `null` quand `dataStatus = 'INSUFFISANT'` —
 * jamais un chiffre inventé. `windowDays`/`movementDaysInWindow` toujours
 * présents : période de référence de la prévision, à afficher
 * systématiquement avec le résultat.
 *
 * `averageDailyConsumption`/`suggestedReorderQuantity` sont des `number`
 * (pas des `Decimal` Prisma sérialisés) : calculés en TypeScript à partir
 * de valeurs déjà converties, contrairement à `Item.currentStock`.
 */
export type ForecastDataStatus = 'SUFFISANT' | 'INSUFFISANT';
export type ReorderBasis = 'CONSOMMATION' | 'SEUIL_MINIMUM';

export interface ItemForecast {
  itemId: string;
  status: StockStatus;
  dataStatus: ForecastDataStatus;
  windowDays: number;
  movementDaysInWindow: number;
  averageDailyConsumption: number | null;
  autonomyDays: number | null;
  /** ISO `yyyy-mm-dd`. */
  estimatedStockoutDate: string | null;
  suggestedReorderQuantity: number | null;
  reorderBasis: ReorderBasis | null;
  /** ISO complet — horodatage du calcul (même valeur pour toute une
   * réponse, tous les articles étant calculés dans la même requête), voir
   * prompt Lot 2 : "chaque prévision affiche sa date de calcul". */
  calculatedAt: string;
}
