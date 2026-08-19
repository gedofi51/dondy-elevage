import { safeDivide } from '../../../common/calculations/safe-math.util';

/** §5.3 : "Coût par œuf = charges directes de la période / œufs commercialisables."
 * computeRevenueFcfa/computeTotalExpensesFcfa/computeGrossMarginFcfa sont
 * génériques (sommes/soustraction pures) et réutilisés tels quels depuis
 * broiler-finance.calculations.ts — même précédent que SalesService qui
 * importe déjà broiler-sales.calculations.ts en cross-module. */
export function computeCostPerEggFcfa(
  totalExpensesFcfa: number,
  eggsSellableCount: number,
): number {
  return safeDivide(totalExpensesFcfa, eggsSellableCount);
}
