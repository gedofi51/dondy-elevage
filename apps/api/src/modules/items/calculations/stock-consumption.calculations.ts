export interface StockConsumptionInstruction {
  itemId: string;
  type: 'ENTREE' | 'SORTIE';
  reason: 'RETOUR' | 'DISTRIBUTION_BANDE';
  quantity: number;
}

/**
 * Calcule les mouvements de stock nécessaires pour faire correspondre
 * l'état du stock à une correction de itemId/quantité sur une ligne qui
 * consomme un article (feedItemId+feedDistributedKg sur
 * BroilerDailyRecord/LayerDailyRecord, itemId+quantityUsed sur
 * BroilerHealthEvent/LayerHealthEvent une fois status=REALISE) — jamais la
 * valeur brute (une ligne peut être corrigée plusieurs fois, voir plan
 * Phase 7 section E). Pour un HealthEvent, l'appelant doit annuler
 * previousItemId/previousQuantity quand previousStatus != REALISE et
 * nextItemId/nextQuantity quand nextStatus != REALISE (aucun mouvement ne
 * doit exister hors de ce statut) avant d'appeler cette fonction — elle
 * ne connaît rien du statut, seulement des deux états consommation.
 *
 * - Même article, quantité augmentée -> SORTIE du delta.
 * - Même article, quantité réduite -> ENTREE (RETOUR) de la réduction.
 * - Article changé -> ENTREE (RETOUR) intégrale de l'ancien article +
 *   SORTIE intégrale du nouveau (jamais un delta croisé entre deux
 *   articles différents).
 * - Article retiré (nextItemId=null) -> ENTREE (RETOUR) intégrale de
 *   l'ancien article, rien sur le nouveau.
 */
export function computeStockConsumptionInstructions(
  previousItemId: string | null,
  previousQuantity: number,
  nextItemId: string | null,
  nextQuantity: number,
): StockConsumptionInstruction[] {
  const instructions: StockConsumptionInstruction[] = [];
  const itemChanged =
    previousItemId !== null && nextItemId !== null && previousItemId !== nextItemId;

  if (previousItemId && previousQuantity > 0 && (itemChanged || nextItemId === null)) {
    instructions.push({
      itemId: previousItemId,
      type: 'ENTREE',
      reason: 'RETOUR',
      quantity: previousQuantity,
    });
  }

  if (nextItemId) {
    const baseline = itemChanged || previousItemId === null ? 0 : previousQuantity;
    const delta = nextQuantity - baseline;
    if (delta > 0) {
      instructions.push({
        itemId: nextItemId,
        type: 'SORTIE',
        reason: 'DISTRIBUTION_BANDE',
        quantity: delta,
      });
    } else if (delta < 0) {
      instructions.push({ itemId: nextItemId, type: 'ENTREE', reason: 'RETOUR', quantity: -delta });
    }
  }

  return instructions;
}
