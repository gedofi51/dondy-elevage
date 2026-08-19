/** §5.2 : "Nombre de poules présentes (calcul + ajustement contrôlé)" — la
 * suggestion se calcule depuis la journée précédente, l'utilisateur peut
 * ensuite la remplacer (recomptage physique). Voir LayerDailyRecordsService. */
export function computeSuggestedHenCount(
  previousHenCount: number,
  previousMortality: number,
  previousCulls: number,
  previousOtherExits: number,
): number {
  return previousHenCount - previousMortality - previousCulls - previousOtherExits;
}

/** Écart entre la valeur suggérée et la valeur finalement retenue (saisie
 * manuelle) — journalisé via AuditLogService, pas de colonne dédiée. */
export function computeHeadcountDelta(suggestedHenCount: number, actualHenCount: number): number {
  return actualHenCount - suggestedHenCount;
}

/** Effectif actuel du lot = calculé à la lecture (jamais persisté), comme
 * BroilerBatch.currentHeadcount. Pas de terme "vendu" : contrairement au
 * poulet de chair, la vente/réforme des poules elles-mêmes est hors
 * périmètre Phase 4 (seul otherExitsQuantity capture une sortie générique). */
export function computeLayerCurrentHeadcount(
  initialQuantity: number,
  cumulativeMortality: number,
  cumulativeCulls: number,
  cumulativeOtherExits: number,
): number {
  return initialQuantity - cumulativeMortality - cumulativeCulls - cumulativeOtherExits;
}
