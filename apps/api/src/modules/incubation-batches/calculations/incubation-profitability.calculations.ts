import { safeDivide } from '../../../common/calculations/safe-math.util';

/** §8.8 : coût par poussin éclos = charges totales du lot d'incubation /
 * poussins éclos — distinct du "coût par poulet produit/vendu" de la Phase 3
 * (Broiler), qui porte sur un stade d'élevage ultérieur. */
export function computeCostPerChickHatchedFcfa(
  totalExpensesFcfa: number,
  chicksHatched: number,
): number {
  return safeDivide(totalExpensesFcfa, chicksHatched);
}
