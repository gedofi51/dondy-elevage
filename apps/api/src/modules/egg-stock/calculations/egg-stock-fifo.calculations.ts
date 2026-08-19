export interface EggStockLotForFifo {
  id: string;
  productionDate: Date;
  remaining: number;
}

export interface FifoAllocation {
  lotId: string;
  quantity: number;
}

/**
 * §5.4 : "FIFO : la vente doit proposer/consommer les œufs les plus anciens
 * en priorité." Épuise les lots par productionDate croissante jusqu'à
 * couvrir la quantité demandée. Retourne `null` si le stock total
 * disponible est insuffisant (§15 : aucune vente supérieure au stock
 * disponible) — jamais d'allocation partielle silencieuse.
 */
export function computeFifoAllocation(
  lots: EggStockLotForFifo[],
  requestedQuantity: number,
): FifoAllocation[] | null {
  if (requestedQuantity <= 0) {
    return null;
  }
  const totalAvailable = lots.reduce((sum, lot) => sum + lot.remaining, 0);
  if (requestedQuantity > totalAvailable) {
    return null;
  }

  const sortedLots = [...lots]
    .filter((lot) => lot.remaining > 0)
    .sort((a, b) => a.productionDate.getTime() - b.productionDate.getTime());

  const allocations: FifoAllocation[] = [];
  let remainingToAllocate = requestedQuantity;
  for (const lot of sortedLots) {
    if (remainingToAllocate <= 0) {
      break;
    }
    const takenFromLot = Math.min(lot.remaining, remainingToAllocate);
    allocations.push({ lotId: lot.id, quantity: takenFromLot });
    remainingToAllocate -= takenFromLot;
  }

  return allocations;
}
