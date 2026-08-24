export type StockMovementType = 'ENTREE' | 'SORTIE';

export type StockMovementReason =
  | 'ACHAT'
  | 'RETOUR'
  | 'AJUSTEMENT'
  | 'PRODUCTION_INTERNE'
  | 'DISTRIBUTION_BANDE'
  | 'VENTE'
  | 'PERTE'
  | 'CASSE'
  | 'CONSOMMATION_INTERNE';

/** ACHAT (réception de commande) et DISTRIBUTION_BANDE (suivi quotidien/
 * santé Chair-Pondeuses) sont réservés aux flux automatiques — rejetés
 * (400) par POST /stock-movements. Ces 7 valeurs sont les seules
 * proposées dans le formulaire de mouvement manuel. */
export const MANUAL_STOCK_MOVEMENT_REASONS = [
  'RETOUR',
  'AJUSTEMENT',
  'PRODUCTION_INTERNE',
  'VENTE',
  'PERTE',
  'CASSE',
  'CONSOMMATION_INTERNE',
] as const satisfies readonly StockMovementReason[];

/** Append-only (pas de PATCH/DELETE) — une correction est un mouvement
 * compensatoire inverse avec motif, jamais une édition en place.
 * `quantity` (Decimal) sérialisé en string (voir Item.currentStock).
 * `sourceType`/`sourceId` : traçabilité polymorphe de l'origine
 * automatique, `null` = mouvement manuel. */
export interface StockMovement {
  id: string;
  farmId: string;
  itemId: string;
  type: StockMovementType;
  reason: StockMovementReason;
  quantity: string;
  unitCostFcfaSnapshot: number;
  totalValueFcfa: number;
  justification: string | null;
  sourceType: string | null;
  sourceId: string | null;
  date: string;
  createdAt: string;
  createdBy: string;
}

/** `type` reste requis sur le DTO même si dérivable du `reason` pour tous
 * les cas sauf AJUSTEMENT — le frontend le calcule et l'envoie toujours
 * explicitement (voir features/stock-movements/reason-type.ts). */
export interface CreateStockMovementInput {
  itemId: string;
  type: StockMovementType;
  reason: StockMovementReason;
  quantity: number;
  date: string;
  /** Requis si reason=ACHAT|PRODUCTION_INTERNE (ACHAT non atteignable en
   * saisie manuelle, mais le type le documente pour PRODUCTION_INTERNE). */
  unitCostFcfa?: number;
  /** Requis si reason=AJUSTEMENT (§15). */
  justification?: string;
}
