/**
 * Garde-fou unique pour toutes les divisions du module Chair — §6/§12 du
 * cahier des charges V1 : "Toutes les divisions doivent être protégées
 * contre une division par zéro : le système retourne 0%, jamais #DIV/0!."
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}
