export type EmployeeStatus = 'ACTIF' | 'CONGE' | 'SUSPENDU' | 'DEPART';

/**
 * `baseSalaryFcfa` optionnel — jamais présumé présent. L'API masque ce
 * champ (clé absente du JSON, pas `null`) pour tout rôle sans la
 * permission `EMPLOYEES_VIEW_SALARY` (ex. Lecteur/Lecture seule) — voir
 * DETTE_TECHNIQUE.md, mécanisme de masquage champ par champ (Lot 5). Le
 * front DOIT vérifier sa présence avant tout affichage (Lot 6a, règle UI
 * explicite : ne jamais supposer sa présence ni afficher un vide
 * suspect en son absence).
 */
export interface Employee {
  id: string;
  farmId: string;
  code: string;
  buildingId: string | null;
  managerId: string | null;
  name: string;
  position: string;
  contractType: string | null;
  phone: string | null;
  hireDate: string;
  endDate: string | null;
  status: EmployeeStatus;
  baseSalaryFcfa?: number;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  deletedAt: string | null;
}

export interface CreateEmployeeInput {
  buildingId?: string;
  managerId?: string;
  name: string;
  position: string;
  contractType?: string;
  phone?: string;
  hireDate: string;
  endDate?: string;
  baseSalaryFcfa: number;
  observations?: string;
}

/** `status` accepte les 4 valeurs (pas de restriction `_EDITABLE_STATUSES`
 * comme Asset) — la règle "réactivation explicite obligatoire si
 * SUSPENDU/DEPART" est un contrôle dynamique côté service (dépend de
 * l'état courant), pas une liste statique de valeurs autorisées, voir
 * apps/api/.../employees.validation.ts. */
export interface UpdateEmployeeInput {
  buildingId?: string;
  managerId?: string;
  name?: string;
  position?: string;
  contractType?: string;
  phone?: string;
  hireDate?: string;
  endDate?: string;
  status?: EmployeeStatus;
  baseSalaryFcfa?: number;
  observations?: string;
}

/**
 * `/employees/roster` (Lot 7-correctif) — champs strictement minimaux,
 * jamais de salaire/contact/contrat (contrairement à `Employee`, qui
 * masque seulement `baseSalaryFcfa` conditionnellement, ce type-ci
 * n'expose ces champs à aucun rôle, y compris ceux qui pourraient voir
 * le salaire ailleurs). Gardé par EMPLOYEES_READ OU ATTENDANCE_READ OU
 * EMPLOYEE_TASKS_READ — pour un rôle comme Responsable élevage qui a
 * accès au pointage/aux tâches mais pas à la fiche employé complète.
 * N'inclut que les employés éligibles (ACTIF/CONGE, jamais SUSPENDU/
 * DEPART) — voir RESTRICTED_EMPLOYEE_STATUSES côté API.
 */
export interface EmployeeRosterEntry {
  id: string;
  code: string;
  name: string;
  status: EmployeeStatus;
}
