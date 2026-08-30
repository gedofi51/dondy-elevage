import { BadRequestException } from '@nestjs/common';

/** §4 : "net à payer" — suivi indicatif uniquement, jamais un calcul
 * légal de charges sociales/fiscales (voir MODULE_PERSONNEL.md,
 * précision de périmètre). Même style que
 * broiler-sales.calculations.ts.computeNetAmountFcfa (seule convention
 * "net = ..." déjà en place côté Finance dans le projet) : arithmétique
 * directe, pas d'arrondi (FCFA entiers partout). */
export function computeNetPayFcfa(
  baseSalaryFcfa: number,
  bonusFcfa: number,
  deductionsFcfa: number,
  advancesDeductedFcfa: number,
): number {
  return baseSalaryFcfa + bonusFcfa - deductionsFcfa - advancesDeductedFcfa;
}

/** "Avance déduite automatiquement du relevé suivant" — somme des
 * avances encore non déduites (deductedInPayrollId IS NULL) au moment
 * de la création d'un nouveau relevé. Balayées une seule fois, à la
 * création (voir PayrollService) : une avance enregistrée après coup,
 * pendant qu'un relevé est encore en BROUILLON, n'est PAS rattrapée
 * rétroactivement — elle reste en attente pour le relevé suivant,
 * lecture littérale de "relevé suivant" (celui créé après, pas
 * "n'importe quel relevé pas encore validé"). */
export function sumOutstandingAdvancesFcfa(advances: { amountFcfa: number }[]): number {
  return advances.reduce((sum, advance) => sum + advance.amountFcfa, 0);
}

/** §11 ("validations de montants") : un net à payer négatif n'a aucun
 * sens métier (retenues + avances excédant base + primes) — refusé
 * explicitement plutôt que persisté tel quel. */
export function assertNetPayNotNegative(netFcfa: number): void {
  if (netFcfa < 0) {
    throw new BadRequestException(
      'Le net à payer ne peut pas être négatif (retenues et avances supérieures au salaire de base et aux primes).',
    );
  }
}
