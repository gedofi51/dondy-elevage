/** §8.2 : "Coût moyen pondéré recommandé pour la V5." Recalculé sur
 * Item.averageUnitCostFcfa à chaque mouvement ENTREE, jamais recalculé
 * rétroactivement (limite assumée : une correction après coup ne peut
 * pas restaurer "ce que le CUMP aurait dû être" sans rejouer tout
 * l'historique — voir plan Phase 7, section D). */
export function computeWeightedAverageCost(
  existingQuantity: number,
  existingUnitCostFcfa: number,
  enteredQuantity: number,
  enteredUnitCostFcfa: number,
): number {
  const totalQuantity = existingQuantity + enteredQuantity;
  if (totalQuantity <= 0) {
    return enteredUnitCostFcfa;
  }
  const totalValue =
    existingQuantity * existingUnitCostFcfa + enteredQuantity * enteredUnitCostFcfa;
  return Math.round(totalValue / totalQuantity);
}
