export type StockStatus = 'VERT' | 'ORANGE' | 'ROUGE';

/** Donnée de référence en lecture seule côté frontend cette phase (select
 * `feedItemId` du suivi quotidien Chair, `itemId` des événements santé) —
 * pas de mutation. `currentStock`/`minThreshold` sont des `Decimal` Prisma
 * sérialisés en chaîne (voir WaterPoint.initialIndex). */
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
