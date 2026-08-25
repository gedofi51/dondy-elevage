/** 6 FK de rattachement métier optionnels et indépendants + supplierId —
 * une "dépense générale de ferme" = tous absents, explicitement supporté
 * par construction (aucune validation ne l'interdit). `quantity` (Decimal)
 * sérialisé en string. Soft delete (deletedAt non exposé côté frontend,
 * les lignes supprimées ne sont jamais renvoyées par l'API). */
export interface Expense {
  id: string;
  farmId: string;
  batchId: string | null;
  layerBatchId: string | null;
  chickBatchId: string | null;
  breederBatchId: string | null;
  incubationBatchId: string | null;
  waterPointId: string | null;
  /** Phase 16 — coûts postérieurs à l'acquisition d'un actif (réparation,
   * consommable, autre), même patron d'extension incrémentale que les 6 FK
   * ci-dessus (Phase 7). Alimente le TCO partiel calculé sur Asset. */
  assetId: string | null;
  date: string;
  category: string;
  description: string | null;
  quantity: string | null;
  unitPriceFcfa: number | null;
  amountFcfa: number;
  supplierId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateExpenseInput {
  batchId?: string;
  layerBatchId?: string;
  chickBatchId?: string;
  breederBatchId?: string;
  incubationBatchId?: string;
  waterPointId?: string;
  assetId?: string;
  date: string;
  category: string;
  description?: string;
  quantity?: number;
  unitPriceFcfa?: number;
  amountFcfa: number;
  supplierId?: string;
}

export interface UpdateExpenseInput {
  batchId?: string;
  layerBatchId?: string;
  chickBatchId?: string;
  breederBatchId?: string;
  incubationBatchId?: string;
  waterPointId?: string;
  assetId?: string;
  date?: string;
  category?: string;
  description?: string;
  quantity?: number;
  unitPriceFcfa?: number;
  amountFcfa?: number;
  supplierId?: string;
}
