import { ConflictException } from '@nestjs/common';

/** Une avance déjà déduite dans un relevé de paie (deductedInPayrollId
 * renseigné) devient un fait comptable acquis — même discipline que
 * Payroll une fois VALIDE : plus aucune modification possible. Avant
 * cela, une correction (date, montant, observations) reste libre. */
export function assertAdvanceEditable(deductedInPayrollId: string | null): void {
  if (deductedInPayrollId) {
    throw new ConflictException(
      'Cette avance a déjà été déduite d’un relevé de paie — elle ne peut plus être modifiée.',
    );
  }
}
