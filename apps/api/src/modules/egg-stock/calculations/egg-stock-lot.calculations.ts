import type { EggStockMovementType } from '@prisma/client';

/** Types de mouvement qui réduisent le stock restant d'un lot — tout sauf
 * ENTREE_ANNULATION (compensation d'une vente annulée, qui le restaure). */
const OUTFLOW_TYPES: EggStockMovementType[] = [
  'SORTIE_VENTE',
  'PERTE_CASSE',
  'PERTE_SOUILLURE',
  'CONSOMMATION_INTERNE',
  'DON',
  'PERTE_AUTRE',
];

export interface EggStockMovementLike {
  type: EggStockMovementType;
  quantity: number;
}

/** Quantité restante d'un lot = jamais une colonne persistée, toujours
 * dérivée des mouvements append-only (§5.4, voir EggStockLot.quantityProduced). */
export function computeLotRemaining(
  quantityProduced: number,
  movements: EggStockMovementLike[],
): number {
  const outflow = movements
    .filter((m) => OUTFLOW_TYPES.includes(m.type))
    .reduce((sum, m) => sum + m.quantity, 0);
  const compensatedInflow = movements
    .filter((m) => m.type === 'ENTREE_ANNULATION')
    .reduce((sum, m) => sum + m.quantity, 0);
  return quantityProduced - outflow + compensatedInflow;
}
