import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { EmployeeStatus } from '@prisma/client';
import { PERMISSIONS } from '../../common/rbac/permissions.constants';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';

/** Type de retour du contrôleur une fois le masquage appliqué —
 * baseSalaryFcfa devient optionnel (absent, pas juste undefined, une
 * fois sérialisé en JSON) plutôt que retiré du type Employee complet. */
export type EmployeeMaybeWithSalary = Omit<Employee, 'baseSalaryFcfa'> & {
  baseSalaryFcfa?: number;
};

/** Statuts où la fiche est gelée sauf réactivation explicite (règle du
 * Lot 2 : "un employé inactif/sorti n'est modifiable que pour
 * réactivation explicite"). CONGE reste pleinement modifiable — un
 * employé en congé reste un employé actif au sens RH, seul un arrêt
 * (SUSPENDU) ou un départ (DEPART) gèle la fiche. */
export const RESTRICTED_EMPLOYEE_STATUSES: EmployeeStatus[] = ['SUSPENDU', 'DEPART'];

/**
 * Pure — testée isolément (employees.validation.spec.ts), même patron
 * que les fonctions de calcul du projet (ex.
 * depreciation.calculations.ts) plutôt qu'un test avec PrismaService
 * mocké : aucun module CRUD existant (Buildings, Expenses, Assets...)
 * n'a de test unitaire dédié à son service, uniquement des tests e2e —
 * cette fonction est extraite précisément pour rester testable sans
 * déroger à cette convention.
 *
 * Une fiche SUSPENDU/DEPART n'accepte qu'un PATCH dont l'intention est
 * la réactivation (`status: 'ACTIF'`) — tout autre changement, y compris
 * simultané à la réactivation, est refusé tant que ce signal n'est pas
 * présent.
 */
export function assertUpdateAllowed(currentStatus: EmployeeStatus, dto: UpdateEmployeeDto): void {
  if (!RESTRICTED_EMPLOYEE_STATUSES.includes(currentStatus)) {
    return;
  }
  if (dto.status !== 'ACTIF') {
    throw new ConflictException(
      'Cette fiche employé est suspendue ou sortie — seule une réactivation explicite (status: "ACTIF") est autorisée.',
    );
  }
}

/** Cross-field endDate >= hireDate — voir DTO pour le choix de le
 * valider ici plutôt que via un ValidatorConstraint class-validator
 * (aucun précédent dans le projet, même discipline que
 * Asset.serviceDate >= purchaseDate en Phase 20). */
export function assertDatesConsistent(hireDate: Date, endDate: Date | null | undefined): void {
  if (endDate && endDate < hireDate) {
    throw new BadRequestException("La date de sortie ne peut pas précéder la date d'embauche.");
  }
}

/**
 * Masquage champ par champ (Lot 5) — PREMIER précédent de ce type dans
 * le projet, documenté comme réutilisable dans DETTE_TECHNIQUE.md.
 * Appliquée exclusivement à la frontière contrôleur (chaque méthode
 * d'EmployeesController), jamais dans EmployeesService/getRaw : les
 * autres services du module Personnel (Payroll notamment) ont besoin de
 * la vraie valeur de `baseSalaryFcfa` pour leurs calculs internes
 * (instantané à la création d'un relevé de paie) indépendamment de ce
 * que l'utilisateur courant a le droit de VOIR dans une réponse HTTP —
 * conflater "donnée interne" et "donnée affichée" aurait cassé ce
 * besoin dès qu'un rôle avec PAYROLL_CREATE mais sans
 * EMPLOYEES_VIEW_SALARY existerait (aucun cas aujourd'hui, mais un
 * couplage fragile à éviter dès l'origine).
 */
export function maskSalaryForResponse<T extends { baseSalaryFcfa: number }>(
  employee: T,
  permissions: string[],
): Omit<T, 'baseSalaryFcfa'> & { baseSalaryFcfa?: number } {
  if (permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SALARY)) {
    return employee;
  }
  const masked: Omit<T, 'baseSalaryFcfa'> & { baseSalaryFcfa?: number } = { ...employee };
  delete masked.baseSalaryFcfa;
  return masked;
}
