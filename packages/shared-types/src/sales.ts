export type SaleProductType = 'POULET_CHAIR' | 'OEUFS' | 'POUSSINS' | 'EAU';
export type SaleMode = 'UNITE' | 'POIDS' | 'LOT';
export type SaleStatus =
  | 'BROUILLON'
  | 'RESERVEE'
  | 'CONFIRMEE'
  | 'PAYEE'
  | 'PARTIELLEMENT_PAYEE'
  | 'IMPAYEE'
  | 'ANNULEE';

/** `weightKg` est un `Decimal` Prisma nullable — sérialisé en chaîne. */
export interface Sale {
  id: string;
  farmId: string;
  productType: SaleProductType;
  batchId: string | null;
  layerBatchId: string | null;
  chickBatchId: string | null;
  waterPointId: string | null;
  saleNumber: string;
  date: string;
  customerId: string | null;
  sellerId: string;
  saleMode: SaleMode;
  quantity: number;
  weightKg: string | null;
  unitPriceFcfa: number;
  discountFcfa: number;
  grossAmountFcfa: number;
  netAmountFcfa: number;
  status: SaleStatus;
  observation: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateSaleInput {
  productType?: SaleProductType;
  batchId?: string;
  layerBatchId?: string;
  chickBatchId?: string;
  waterPointId?: string;
  date: string;
  /** Requis sauf pour productType=EAU (vente comptoir anonyme possible). */
  customerId?: string;
  /** Défaut = utilisateur courant si omis. */
  sellerId?: string;
  saleMode: SaleMode;
  quantity: number;
  weightKg?: number;
  unitPriceFcfa: number;
  discountFcfa?: number;
  status?: SaleStatus;
  observation?: string;
}
