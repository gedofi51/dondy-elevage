/** §7.2 : "Consommation du jour = index soir - index matin." Cas normal
 * uniquement (soir >= matin) — l'anomalie soir < matin passe par un
 * override manuel côté DTO, voir WaterReadingsService. */
export function computeConsumptionM3(indexSoir: number, indexMatin: number): number {
  return indexSoir - indexMatin;
}

/** §7.2 : "Montant théorique = consommation x tarif." */
export function computeTheoreticalAmountFcfa(
  consumptionM3: number,
  tariffFcfaPerM3: number,
): number {
  return Math.round(consumptionM3 * tariffFcfaPerM3);
}

/** §7.2 : "Écart = encaissé - théorique." */
export function computeVarianceFcfa(cashAmountFcfa: number, theoreticalAmountFcfa: number): number {
  return cashAmountFcfa - theoreticalAmountFcfa;
}

/**
 * Rapprochement informatif entre le comptage de caisse d'un relevé et le
 * total des ventes Sale(EAU) enregistrées pour le même point/jour — voir
 * plan Phase 6, section C. Écart brut, pas de safeDivide (différence de
 * deux montants, pas un ratio) : ne bloque rien, purement visible.
 */
export function computeSalesCashGapFcfa(
  readingCashAmountFcfa: number,
  sumOfEauSalesNetAmountFcfa: number,
): number {
  return readingCashAmountFcfa - sumOfEauSalesNetAmountFcfa;
}
