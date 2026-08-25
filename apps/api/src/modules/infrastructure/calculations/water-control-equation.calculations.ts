/**
 * Cahier V6 §5 — "Équation de contrôle : Eau produite = consommation
 * ferme + eau vendue + pertes/écarts." Réarrangée pour isoler
 * pertes/écarts : gap = produite - (consommation ferme + vendue).
 * Calculée à la lecture, jamais stockée — même philosophie que
 * computeSalesCashGapFcfa (water-reading.calculations.ts) : informatif,
 * ne bloque rien. `pumpedVolumeM3` absent ("si mesurable", §5) rend
 * l'équation non calculable — retourne `null` explicitement plutôt que
 * de fausser un écart avec une valeur par défaut. Une consommation
 * interne absente est traitée comme 0 (terme optionnel, pas de source
 * mesurée existante dans le projet).
 */
export function computeWaterControlGapM3(
  pumpedVolumeM3: number | null,
  farmInternalConsumptionM3: number | null,
  soldVolumeM3: number,
): number | null {
  if (pumpedVolumeM3 === null) {
    return null;
  }
  return pumpedVolumeM3 - (farmInternalConsumptionM3 ?? 0) - soldVolumeM3;
}
