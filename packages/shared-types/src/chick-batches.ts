export type ChickBatchPurpose = 'VENTE' | 'RENOUVELLEMENT';

export type ChickBatchStatus = 'ACTIF' | 'CLOTURE' | 'ANNULE';

export interface ChickBatch {
  id: string;
  farmId: string;
  code: string;
  purpose: ChickBatchPurpose;
  initialQuantity: number;
  buildingId: string | null;
  status: ChickBatchStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** currentHeadcount calculé à la lecture (jamais persisté) — `null` si
 * purpose=RENOUVELLEMENT (jamais vendu, pas de notion d'effectif
 * "restant à vendre"). */
export interface ChickBatchWithComputed extends ChickBatch {
  currentHeadcount: number | null;
}

/** Aucun POST exposé : un ChickBatch naît toujours d'une orientation (voir
 * batch-lineage.ts / POST /incubation-batches/:id/orientation). */

/** purpose/initialQuantity volontairement absents : un ChickBatch naît
 * toujours d'une orientation, ses quantités d'origine ne se corrigent pas
 * rétroactivement (commentaire UpdateChickBatchDto). `status` volontairement
 * omis côté frontend cette phase : contrairement aux autres modules, aucun
 * endpoint dédié /cloturer ni /annuler n'existe pour ChickBatch — ce PATCH
 * générique serait donc la seule UI de transition de statut jamais testée,
 * sans précondition serveur (voir DETTE_TECHNIQUE.md Phase 13). */
export interface UpdateChickBatchInput {
  buildingId?: string;
}
