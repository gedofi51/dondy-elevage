/**
 * Avance sur salaire — sous-ressource d'Employee (`/employees/:id/
 * advances`, Lot 5 API). Pas de champ « solde » exposé par l'API : une
 * avance est soit non déduite (`deductedInPayrollId: null`), soit déduite
 * d'un relevé de paie précis (`deductedInPayrollId` renseigné) — c'est
 * ce statut par avance qu'il faut refléter tel quel, jamais une somme
 * agrégée recalculée côté front (aucun endpoint ne l'expose, voir
 * DETTE_TECHNIQUE.md Lot 6d).
 */
export interface SalaryAdvance {
  id: string;
  farmId: string;
  employeeId: string;
  deductedInPayrollId: string | null;
  date: string;
  amountFcfa: number;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateSalaryAdvanceInput {
  date: string;
  amountFcfa: number;
  observations?: string;
}
