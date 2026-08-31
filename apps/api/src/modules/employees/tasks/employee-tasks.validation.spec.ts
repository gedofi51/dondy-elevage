import { ConflictException } from '@nestjs/common';
import {
  assertEmployeeActiveForNewTask,
  computeIsLate,
  EMPLOYEE_TASK_EDITABLE_STATUSES,
  TERMINAL_TASK_STATUSES,
} from './employee-tasks.validation';

describe('computeIsLate', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  it.each(['A_FAIRE', 'EN_COURS'] as const)(
    'est en retard si dueDate est dépassée et le statut %s est encore ouvert',
    (status) => {
      expect(computeIsLate(status, yesterday)).toBe(true);
    },
  );

  it.each(['A_FAIRE', 'EN_COURS'] as const)(
    'n’est pas en retard si dueDate n’est pas dépassée (%s)',
    (status) => {
      expect(computeIsLate(status, tomorrow)).toBe(false);
    },
  );

  it.each(['REALISEE', 'ANNULEE'] as const)(
    'n’est jamais en retard une fois le statut terminal %s atteint, même dueDate dépassée',
    (status) => {
      expect(computeIsLate(status, yesterday)).toBe(false);
    },
  );
});

describe('assertEmployeeActiveForNewTask', () => {
  it.each(['ACTIF', 'CONGE'] as const)(
    'autorise une nouvelle tâche pour le statut %s',
    (status) => {
      expect(() => assertEmployeeActiveForNewTask(status)).not.toThrow();
    },
  );

  it.each(['SUSPENDU', 'DEPART'] as const)(
    'refuse une nouvelle tâche pour le statut %s',
    (status) => {
      expect(() => assertEmployeeActiveForNewTask(status)).toThrow(ConflictException);
    },
  );
});

describe('constantes de statut', () => {
  it('TERMINAL_TASK_STATUSES contient REALISEE et ANNULEE, rien d’autre', () => {
    expect(TERMINAL_TASK_STATUSES.sort()).toEqual(['ANNULEE', 'REALISEE']);
  });

  it('EMPLOYEE_TASK_EDITABLE_STATUSES exclut ANNULEE (isolé dans son propre endpoint)', () => {
    expect(EMPLOYEE_TASK_EDITABLE_STATUSES).not.toContain('ANNULEE');
    expect(EMPLOYEE_TASK_EDITABLE_STATUSES.sort()).toEqual(['A_FAIRE', 'EN_COURS', 'REALISEE']);
  });
});
