import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayrollStatus } from '@prisma/client';

/**
 * Pas de statut ANNULE ajouté à l'enum (Lot 1, déjà en base) — confirmé
 * avant implémentation plutôt que tranché seul (voir DETTE_TECHNIQUE.md) :
 * VALIDE reste le seul statut terminal. Un BROUILLON reste librement
 * corrigeable (PATCH) ; une fois VALIDE, plus aucune modification ni
 * suppression n'est possible — "jamais supprimé" au sens littéral, rien
 * n'est jamais retiré. Une correction post-validation (si un besoin réel
 * émerge) passerait par un nouveau relevé compensatoire, pas un retour en
 * arrière sur celui-ci — hors périmètre de ce lot.
 */
export function assertPayrollEditable(status: PayrollStatus): void {
  if (status === 'VALIDE') {
    throw new ConflictException('Ce relevé de paie est validé — il ne peut plus être modifié.');
  }
}

/** Cross-field periodEnd >= periodStart — même discipline que
 * Employee.endDate >= hireDate (validée en service, pas en DTO, aucun
 * ValidatorConstraint dans le projet). */
export function assertPeriodValid(periodStart: Date, periodEnd: Date): void {
  if (periodEnd < periodStart) {
    throw new BadRequestException(
      'La date de fin de période ne peut pas précéder la date de début.',
    );
  }
}
