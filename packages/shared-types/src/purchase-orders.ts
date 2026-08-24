export type PurchaseOrderStatus =
  | 'BROUILLON'
  | 'COMMANDE'
  | 'PARTIELLEMENT_RECU'
  | 'RECU'
  | 'ANNULE';

/** Seule transition libre exposée via PATCH : BROUILLON -> COMMANDE,
 * vérifiée réellement côté service (409 sinon — contrairement aux
 * modules d'élevage, PurchaseOrder n'a pas le bug "statut terminal non
 * protégé", voir DETTE_TECHNIQUE.md). PARTIELLEMENT_RECU/RECU sont
 * dérivés automatiquement des réceptions, ANNULE passe par l'endpoint
 * dédié (différé cette phase, 0 couverture e2e). */
export const PURCHASE_ORDER_EDITABLE_STATUSES = [
  'BROUILLON',
] as const satisfies readonly PurchaseOrderStatus[];

export interface PurchaseOrder {
  id: string;
  farmId: string;
  code: string;
  supplierId: string;
  date: string;
  dueDate: string | null;
  status: PurchaseOrderStatus;
  totalAmountFcfa: number;
  observation: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  farmId: string;
  purchaseOrderId: string;
  itemId: string;
  orderedQuantity: string;
  unitPriceFcfa: number;
  lineAmountFcfa: number;
}

/** receivedQuantity/discrepancy calculés à la lecture (jamais persistés)
 * — cumul de tous les GoodsReceiptItem liés à cette ligne. */
export interface PurchaseOrderItemWithComputed extends PurchaseOrderItem {
  receivedQuantity: number;
  discrepancy: number;
}

/** paidAmountFcfa/balanceFcfa déjà calculés côté serveur à chaque lecture
 * — jamais à recalculer côté client (voir principe directeur CLAUDE.md). */
export interface PurchaseOrderWithComputed extends PurchaseOrder {
  items: PurchaseOrderItemWithComputed[];
  paidAmountFcfa: number;
  balanceFcfa: number;
}

export interface CreatePurchaseOrderItemInput {
  itemId: string;
  orderedQuantity: number;
  unitPriceFcfa: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  date: string;
  dueDate?: string;
  observation?: string;
  items: CreatePurchaseOrderItemInput[];
}

/** supplierId/items volontairement absents : figés à la création (une
 * commande erronée s'annule et se recrée, jamais éditée). */
export interface UpdatePurchaseOrderInput {
  date?: string;
  dueDate?: string;
  observation?: string;
  status?: PurchaseOrderStatus;
}
