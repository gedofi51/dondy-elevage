/** Soustraction d'affichage simple sur des nombres déjà authoritatifs
 * (orderedQuantity et receivedQuantity cumulée sont tous deux déjà
 * calculés/exposés par le serveur, voir PurchaseOrderItemWithComputed) —
 * pas une "formule métier" au sens de discrepancy (qui, elle, n'est
 * jamais recalculée côté client). Ne descend jamais sous 0 : un surplus
 * déjà réceptionné (discrepancy positif) ne doit pas afficher un
 * "restant" négatif trompeur. */
export function computeRemainingToReceive(orderedQuantity: number, receivedQuantity: number): number {
  return Math.max(orderedQuantity - receivedQuantity, 0);
}
