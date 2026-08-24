/** Réplique fidèle de calculations/incubation-kpi.calculations.ts côté API
 * — ces 4 taux ne sont exposés par AUCUNE route (ni GET /:id, ni un
 * endpoint dédié), voir DETTE_TECHNIQUE.md Phase 13. `safeDivide` :
 * dénominateur nul → 0, jamais Infinity/NaN. */
function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeFertileEggs(eggsIncubated: number, eggsInfertile: number): number {
  return eggsIncubated - eggsInfertile;
}

export function computeHatchRatePercent(chicksHatched: number, eggsIncubated: number): number {
  return safeDivide(chicksHatched, eggsIncubated) * 100;
}

export function computeFertilityRatePercent(fertileEggs: number, eggsIncubated: number): number {
  return safeDivide(fertileEggs, eggsIncubated) * 100;
}

export function computeEmbryonicMortalityRatePercent(
  embryonicMortality: number,
  fertileEggs: number,
): number {
  return safeDivide(embryonicMortality, fertileEggs) * 100;
}

export function computeInfectedRatePercent(eggsInfected: number, eggsIncubated: number): number {
  return safeDivide(eggsInfected, eggsIncubated) * 100;
}
