/**
 * Tâche assignée à un employé — sous-ressource d'Employee (`/employees/:id/
 * tasks`, Lot 4 API). Même gabarit que MaintenanceTask (statut,
 * cancelReason, observations, isLate calculé), adapté : REALISEE reste
 * directement accessible en PATCH générique faute d'équivalent à
 * MaintenanceIntervention pour le produire en effet de bord (voir
 * apps/api/.../employee-tasks.validation.ts) ; ANNULEE reste isolé,
 * atteignable uniquement via POST /employees/:id/tasks/:taskId/annuler.
 */
export type EmployeeTaskStatus = 'A_FAIRE' | 'EN_COURS' | 'REALISEE' | 'ANNULEE';

/** REALISEE/ANNULEE sont terminaux (voir TERMINAL_TASK_STATUSES côté API) —
 * ANNULEE n'est jamais éditable via PATCH générique, uniquement via
 * l'endpoint /annuler dédié (interdiction explicite du Lot 6c). */
export const EMPLOYEE_TASK_EDITABLE_STATUSES = ['A_FAIRE', 'EN_COURS', 'REALISEE'] as const;

export interface EmployeeTask {
  id: string;
  farmId: string;
  employeeId: string;
  designation: string;
  dueDate: string;
  status: EmployeeTaskStatus;
  cancelReason: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** `isLate` : calculé à la lecture côté API (dueDate dépassée ET statut
 * encore ouvert) — jamais recalculé côté front, voir DETTE_TECHNIQUE.md
 * Lot 6c. */
export interface EmployeeTaskWithComputed extends EmployeeTask {
  isLate: boolean;
}

/** `status` absent : toujours A_FAIRE à la création (défaut schema.prisma). */
export interface CreateEmployeeTaskInput {
  designation: string;
  dueDate: string;
  observations?: string;
}

export interface UpdateEmployeeTaskInput {
  designation?: string;
  dueDate?: string;
  status?: (typeof EMPLOYEE_TASK_EDITABLE_STATUSES)[number];
  observations?: string;
}

export interface CancelEmployeeTaskInput {
  cancelReason?: string;
}
