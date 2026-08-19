import { safeDivide } from './safe-math.util';

/** §12.1 : "Charges totales = somme des charges affectées à la bande." */
export function computeTotalExpensesFcfa(amountsFcfa: number[]): number {
  return amountsFcfa.reduce((sum, amount) => sum + amount, 0);
}

/** §12.1 : "CA bande = somme de toutes les ventes de la bande." */
export function computeRevenueFcfa(netAmountsFcfa: number[]): number {
  return netAmountsFcfa.reduce((sum, amount) => sum + amount, 0);
}

/** §12.1 : "Marge brute = chiffre d'affaires - charges directes." */
export function computeGrossMarginFcfa(revenueFcfa: number, totalExpensesFcfa: number): number {
  return revenueFcfa - totalExpensesFcfa;
}

/** §12.1 : "Rentabilité (%) = marge / charges × 100." */
export function computeProfitabilityRate(marginFcfa: number, totalExpensesFcfa: number): number {
  return safeDivide(marginFcfa, totalExpensesFcfa) * 100;
}

/** §12.2 : "Coût par poulet produit = charges totales / poulets commercialisables." */
export function computeCostPerChickProducedFcfa(
  totalExpensesFcfa: number,
  sellableCount: number,
): number {
  return safeDivide(totalExpensesFcfa, sellableCount);
}

/** §12.2 : "Coût par poulet vendu = charges totales / nombre vendu." */
export function computeCostPerChickSoldFcfa(totalExpensesFcfa: number, soldCount: number): number {
  return safeDivide(totalExpensesFcfa, soldCount);
}
