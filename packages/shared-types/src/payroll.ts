/**
 * Suivi indicatif de la paie — sous-ressource d'Employee (`/employees/:id/
 * payroll`, Lot 5 API). Pas de calcul légal de charges/fiscalité, pas de
 * bulletin à valeur légale (voir MODULE_PERSONNEL.md, précision de
 * périmètre). `baseSalaryFcfa`/`netFcfa` sont des instantanés stockés
 * (jamais recalculés à la lecture) — un bulletin déjà émis ne doit jamais
 * changer si le salaire de base de l'employé change ensuite.
 *
 * Accès (PAYROLL_READ/CREATE/UPDATE) : Propriétaire/Administrateur,
 * Gérant/Responsable ferme, Comptable/Responsable financier uniquement
 * (vérifié dans roles.catalog.ts) — ces 3 rôles ont systématiquement
 * aussi EMPLOYEES_VIEW_SALARY. Aucun rôle « lecture seule » intermédiaire
 * n'existe pour cette ressource (contrairement à Attendance/EmployeeTask) :
 * pas de masquage champ par champ nécessaire ici, l'accès est binaire au
 * niveau de l'endpoint (403 sinon), donc aucun champ optionnel dans ce
 * type — voir DETTE_TECHNIQUE.md Lot 6d.
 */
export type PayrollStatus = 'BROUILLON' | 'VALIDE';

export interface Payroll {
  id: string;
  farmId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  baseSalaryFcfa: number;
  bonusFcfa: number;
  deductionsFcfa: number;
  netFcfa: number;
  status: PayrollStatus;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** `status` absent : toujours BROUILLON à la création. `baseSalaryFcfa`/
 * `netFcfa` absents : calculés côté serveur (instantané du salaire de
 * l'employé, déduction des avances non déduites). */
export interface CreatePayrollInput {
  periodStart: string;
  periodEnd: string;
  bonusFcfa?: number;
  deductionsFcfa?: number;
  observations?: string;
}

/** `status` n'accepte que 'VALIDE' — aucun retour possible depuis ce
 * statut terminal (voir payroll.validation.ts côté API).
 * `periodStart`/`periodEnd`/`baseSalaryFcfa`/`netFcfa` absents :
 * immuables après création. */
export interface UpdatePayrollInput {
  bonusFcfa?: number;
  deductionsFcfa?: number;
  status?: 'VALIDE';
  observations?: string;
}
