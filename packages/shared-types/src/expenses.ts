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
  date?: string;
  category?: string;
  description?: string;
  quantity?: number;
  unitPriceFcfa?: number;
  amountFcfa?: number;
  supplierId?: string;
}
