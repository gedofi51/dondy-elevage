/** Aperçu de coût des pièces, purement informatif côté client — le
 * serveur reste seul autoritaire sur `partsCostFcfa` (calculé depuis les
 * StockMovement réellement créés, au CUMP en vigueur au moment de la
 * transaction serveur). Contrairement à line-totals.ts (PurchaseOrder, où
 * le prix est saisi par l'utilisateur des deux côtés, aucune divergence
 * possible hors arrondi), le CUMP utilisé ici peut évoluer entre
 * l'ouverture du formulaire et la soumission (réception concurrente) —
 * c'est une ESTIMATION, pas un miroir garanti du calcul serveur. Voir
 * DETTE_TECHNIQUE.md Phase 19. */
export function computePartCostPreviewFcfa(quantity: number, averageUnitCostFcfa: number): number {
  return Math.round(quantity * averageUnitCostFcfa);
}

export function computePartsCostPreviewFcfa(
  parts: { quantity: number; averageUnitCostFcfa: number }[],
): number {
  return parts.reduce((sum, p) => sum + computePartCostPreviewFcfa(p.quantity, p.averageUnitCostFcfa), 0);
}
