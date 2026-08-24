export interface GoodsReceiptItem {
  id: string;
  farmId: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  receivedQuantity: string;
}

export interface GoodsReceipt {
  id: string;
  farmId: string;
  purchaseOrderId: string;
  date: string;
  responsibleId: string;
  observation: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface CreateGoodsReceiptItemInput {
  purchaseOrderItemId: string;
  receivedQuantity: number;
}

/** Défaut serveur = utilisateur courant si `responsibleId` omis. Seules
 * les lignes avec `receivedQuantity > 0` doivent être envoyées — le
 * backend rejette une ligne à 0 (`@Min(0.001)`), donc le formulaire
 * filtre les lignes non touchées avant soumission. */
export interface CreateGoodsReceiptInput {
  date: string;
  responsibleId?: string;
  observation?: string;
  items: CreateGoodsReceiptItemInput[];
}
