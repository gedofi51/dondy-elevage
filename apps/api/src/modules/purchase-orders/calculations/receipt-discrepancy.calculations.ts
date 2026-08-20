/** §8.4 : "Réception... quantités reçues, écarts." Positif = surplus,
 * négatif = manquant, 0 = conforme. */
export function computeReceiptDiscrepancy(
  orderedQuantity: number,
  cumulativeReceivedQuantity: number,
): number {
  return cumulativeReceivedQuantity - orderedQuantity;
}
