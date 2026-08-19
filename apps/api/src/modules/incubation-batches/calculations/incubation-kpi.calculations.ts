import { safeDivide } from '../../../common/calculations/safe-math.util';

/** §6.4 : "Œufs fécondés = œufs incubés - œufs non fécondés." */
export function computeFertileEggs(eggsIncubated: number, eggsInfertile: number): number {
  return eggsIncubated - eggsInfertile;
}

/** §6.4 : "Taux d'éclosion (%) = poussins éclos / œufs incubés × 100." */
export function computeHatchRatePercent(chicksHatched: number, eggsIncubated: number): number {
  return safeDivide(chicksHatched, eggsIncubated) * 100;
}

/** §6.4 : "Taux de fécondité (%) = œufs fécondés / œufs incubés × 100." */
export function computeFertilityRatePercent(fertileEggs: number, eggsIncubated: number): number {
  return safeDivide(fertileEggs, eggsIncubated) * 100;
}

/** §6.4 : "Taux de mortalité embryonnaire (%) = mortalité embryonnaire / œufs fécondés × 100." */
export function computeEmbryonicMortalityRatePercent(
  embryonicMortality: number,
  fertileEggs: number,
): number {
  return safeDivide(embryonicMortality, fertileEggs) * 100;
}

/** §6.4 : "Taux d'œufs infectés (%) = œufs infectés / œufs incubés × 100." */
export function computeInfectedRatePercent(eggsInfected: number, eggsIncubated: number): number {
  return safeDivide(eggsInfected, eggsIncubated) * 100;
}
