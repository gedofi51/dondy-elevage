/** Effectif actuel d'un lot de poussins = calculé à la lecture (jamais
 * persisté), comme BroilerBatch.currentHeadcount. Pas de terme mortalité/
 * réforme : un ChickBatch n'a pas de suivi journalier (courte durée entre
 * l'orientation et la vente/l'affectation au renouvellement) — seul le
 * cumul des ventes confirmées est soustrait. */
export function computeChickCurrentHeadcount(
  initialQuantity: number,
  cumulativeConfirmedSold: number,
): number {
  return initialQuantity - cumulativeConfirmedSold;
}
