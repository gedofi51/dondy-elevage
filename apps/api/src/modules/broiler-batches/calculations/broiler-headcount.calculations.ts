import { safeDivide } from '../../../common/calculations/safe-math.util';

/** §4.3 : "Effectif démarré = Nombre reçu - morts à l'arrivée." */
export function computeStartedQuantity(
  receivedQuantity: number,
  deadOnArrivalQuantity: number,
): number {
  return receivedQuantity - deadOnArrivalQuantity;
}

export interface RemainingHeadcountInput {
  startedQuantity: number;
  cumulativeMortality: number;
  cumulativeCulls: number;
  cumulativeOtherExits: number;
  /** Somme des Sale.quantity dont le statut n'est pas BROUILLON/RESERVEE/ANNULEE
   * (§10.5 : seules les ventes confirmées ou postérieures réduisent l'effectif). */
  cumulativeConfirmedSold: number;
}

/**
 * §6.1 : "Effectif vivant = Effectif initial - mortalité cumulée - réformes -
 * autres sorties - ventes." §17 : cette équation est une règle fondamentale,
 * toute divergence doit produire une alerte de cohérence (pas une erreur).
 */
export function computeRemainingHeadcount(input: RemainingHeadcountInput): number {
  return (
    input.startedQuantity -
    input.cumulativeMortality -
    input.cumulativeCulls -
    input.cumulativeOtherExits -
    input.cumulativeConfirmedSold
  );
}

/** §6.2 : "Taux mortalité journalier = mortalité du jour / effectif début de journée × 100." */
export function computeDailyMortalityRate(
  mortalityOfDay: number,
  headcountStartOfDay: number,
): number {
  return safeDivide(mortalityOfDay, headcountStartOfDay) * 100;
}

/** §6.2 : "Taux mortalité cumulé = mortalité totale / effectif initial × 100." */
export function computeCumulativeMortalityRate(
  totalMortality: number,
  initialHeadcount: number,
): number {
  return safeDivide(totalMortality, initialHeadcount) * 100;
}
