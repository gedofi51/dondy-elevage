export type EggStockMovementType =
  | 'SORTIE_VENTE'
  | 'ENTREE_ANNULATION'
  | 'PERTE_CASSE'
  | 'PERTE_SOUILLURE'
  | 'CONSOMMATION_INTERNE'
  | 'DON'
  | 'PERTE_AUTRE';

/** SORTIE_VENTE et ENTREE_ANNULATION sont gérés exclusivement par le
 * service de vente (FIFO automatique) — rejetés en 400 si saisis
 * manuellement. Seules ces 5 valeurs doivent apparaître dans un
 * formulaire de perte manuelle. */
export const MANUAL_EGG_STOCK_MOVEMENT_TYPES = [
  'PERTE_CASSE',
  'PERTE_SOUILLURE',
  'CONSOMMATION_INTERNE',
  'DON',
  'PERTE_AUTRE',
] as const satisfies readonly EggStockMovementType[];

/** Pas de champ `remaining`/`status` en base — toujours dérivé à la
 * lecture (quantityProduced - sorties + entrées d'annulation), jamais
 * stocké. `caliber` est un texte libre, hors périmètre d'écriture V1
 * (toujours "non_calibre" en pratique, aucun DTO ne l'expose). */
export interface EggStockLotWithRemaining {
  id: string;
  farmId: string;
  batchId: string;
  dailyRecordId: string;
  productionDate: string;
  caliber: string;
  quantityProduced: number;
  remaining: number;
  createdAt: string;
}

/** Append-only — jamais d'update/delete côté API. */
export interface EggStockMovement {
  id: string;
  farmId: string;
  lotId: string;
  type: EggStockMovementType;
  quantity: number;
  date: string;
  saleId: string | null;
  reason: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface CreateEggStockMovementInput {
  lotId: string;
  type: EggStockMovementType;
  quantity: number;
  date: string;
  reason?: string;
}
