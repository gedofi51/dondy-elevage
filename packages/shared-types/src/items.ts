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
