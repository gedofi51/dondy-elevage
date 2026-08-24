/** Calcul d'affichage seul (aperçu avant soumission) — le serveur reste le
 * seul calculateur autoritaire de `totalAmountFcfa` (arrondi identique,
 * `Math.round`, voir purchase-orders.service.ts), jamais envoyé au
 * serveur. */
export function computeLineAmountFcfa(orderedQuantity: number, unitPriceFcfa: number): number {
  return Math.round(orderedQuantity * unitPriceFcfa);
}

export function computeOrderTotalFcfa(
  lines: { orderedQuantity: number; unitPriceFcfa: number }[],
): number {
  return lines.reduce((sum, line) => sum + computeLineAmountFcfa(line.orderedQuantity, line.unitPriceFcfa), 0);
}
