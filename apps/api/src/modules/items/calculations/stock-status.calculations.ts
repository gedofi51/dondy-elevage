import { safeDivide } from '../../../common/calculations/safe-math.util';

export type StockStatus = 'VERT' | 'ORANGE' | 'ROUGE';

/** STOCKS.md : VERT=stock normal, ORANGE=stock faible, ROUGE=rupture —
 * dérivé du seuil minimum, jamais stocké. Pas de seuil défini = jamais
 * ORANGE/ROUGE (rien à comparer), sauf rupture totale. */
export function computeStockStatus(currentStock: number, minThreshold: number | null): StockStatus {
  if (currentStock <= 0) {
    return 'ROUGE';
  }
  if (minThreshold !== null && minThreshold > 0 && currentStock <= minThreshold) {
    return 'ORANGE';
  }
  return 'VERT';
}

/** STOCKS.md : "Calculer l'autonomie lorsque cela est pertinent." Nombre
 * de jours restants au rythme de consommation moyen récent. */
export function computeStockAutonomyDays(
  currentStock: number,
  averageDailyConsumption: number,
): number {
  return safeDivide(currentStock, averageDailyConsumption);
}
