export interface FeedMovementInstruction {
  itemId: string;
  type: 'ENTREE' | 'SORTIE';
  reason: 'RETOUR' | 'DISTRIBUTION_BANDE';
  quantity: number;
}

/**
 * Calcule les mouvements de stock nécessaires pour faire correspondre
 * l'état du stock à une correction de feedItemId/feedDistributedKg sur un
 * BroilerDailyRecord/LayerDailyRecord — jamais la valeur brute (une
 * journée peut être PATCHée plusieurs fois, voir plan Phase 7 section E).
 *
 * - Même article, quantité augmentée -> SORTIE du delta.
 * - Même article, quantité réduite -> ENTREE (RETOUR) de la réduction.
 * - Article changé -> ENTREE (RETOUR) intégrale de l'ancien article +
 *   SORTIE intégrale du nouveau (jamais un delta croisé entre deux
 *   articles différents).
 * - Article retiré (nextFeedItemId=null) -> ENTREE (RETOUR) intégrale de
 *   l'ancien article, rien sur le nouveau.
 */
export function computeFeedMovementInstructions(
  previousFeedItemId: string | null,
  previousFeedDistributedKg: number,
  nextFeedItemId: string | null,
  nextFeedDistributedKg: number,
): FeedMovementInstruction[] {
  const instructions: FeedMovementInstruction[] = [];
  const itemChanged =
    previousFeedItemId !== null && nextFeedItemId !== null && previousFeedItemId !== nextFeedItemId;

  if (
    previousFeedItemId &&
    previousFeedDistributedKg > 0 &&
    (itemChanged || nextFeedItemId === null)
  ) {
    instructions.push({
      itemId: previousFeedItemId,
      type: 'ENTREE',
      reason: 'RETOUR',
      quantity: previousFeedDistributedKg,
    });
  }

  if (nextFeedItemId) {
    const baseline = itemChanged || previousFeedItemId === null ? 0 : previousFeedDistributedKg;
    const delta = nextFeedDistributedKg - baseline;
    if (delta > 0) {
      instructions.push({
        itemId: nextFeedItemId,
        type: 'SORTIE',
        reason: 'DISTRIBUTION_BANDE',
        quantity: delta,
      });
    } else if (delta < 0) {
      instructions.push({
        itemId: nextFeedItemId,
        type: 'ENTREE',
        reason: 'RETOUR',
        quantity: -delta,
      });
    }
  }

  return instructions;
}
