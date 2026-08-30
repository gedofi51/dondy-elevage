import { ConflictException } from '@nestjs/common';
import { EmployeeTaskStatus, EmployeeStatus } from '@prisma/client';
import { RESTRICTED_EMPLOYEE_STATUSES } from '../employees.validation';

/** REALISEE/ANNULEE sont terminaux, mêmes valeurs que
 * MaintenanceTasksService.TERMINAL_STATUSES (Phase 17/20) — pas de
 * réactivation, une tâche clôturée le reste. */
export const TERMINAL_TASK_STATUSES: EmployeeTaskStatus[] = ['REALISEE', 'ANNULEE'];

/**
 * ANNULEE volontairement exclu : contrairement à MaintenanceTask
 * (REALISEE atteint uniquement comme effet de bord d'une
 * MaintenanceIntervention, ANNULEE uniquement via POST .../annuler),
 * EmployeeTask n'a pas d'entité "intervention" pour produire REALISEE —
 * il doit donc rester directement accessible en PATCH, adaptation
 * délibérée du patron Maintenance (voir DETTE_TECHNIQUE.md). ANNULEE
 * reste isolé dans son propre endpoint (même discipline que Maintenance :
 * une annulation mérite un motif et une action distincte d'une simple
 * mise à jour de progression).
 */
export const EMPLOYEE_TASK_EDITABLE_STATUSES: EmployeeTaskStatus[] = [
  'A_FAIRE',
  'EN_COURS',
  'REALISEE',
];

/** "isLate" — calculé à la lecture, jamais stocké, même patron que
 * MaintenanceTasksService.attachComputed() (dueDate dépassée ET statut
 * encore ouvert). */
export function computeIsLate(status: EmployeeTaskStatus, dueDate: Date): boolean {
  return !TERMINAL_TASK_STATUSES.includes(status) && dueDate.getTime() < Date.now();
}

/** "Pointage impossible sur un employé inactif" (Lot 3) étendu aux
 * tâches : même définition d'"inactif" (SUSPENDU/DEPART, pas CONGE),
 * appliquée uniquement à la création d'une nouvelle tâche — modifier
 * une tâche déjà assignée à un employé devenu inactif depuis reste
 * possible (ex. la clôturer). */
export function assertEmployeeActiveForNewTask(employeeStatus: EmployeeStatus): void {
  if (RESTRICTED_EMPLOYEE_STATUSES.includes(employeeStatus)) {
    throw new ConflictException('Impossible d’assigner une tâche à un employé suspendu ou sorti.');
  }
}
