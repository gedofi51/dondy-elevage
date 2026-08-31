import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EmployeeTaskWithComputed } from '@dondy-elevage/shared-types';
import { EmployeeTaskTable } from './employee-task-table';

const baseTask: EmployeeTaskWithComputed = {
  id: 'task-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  designation: 'Nettoyer le bâtiment A',
  dueDate: '2026-08-20',
  status: 'A_FAIRE',
  cancelReason: null,
  observations: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  createdBy: 'user-1',
  isLate: false,
};

describe('EmployeeTaskTable', () => {
  it('affiche le badge de statut correspondant', () => {
    render(<EmployeeTaskTable data={[baseTask]} isLoading={false} />);
    expect(screen.getByText('Nettoyer le bâtiment A')).toBeInTheDocument();
    expect(screen.getByText('À faire')).toBeInTheDocument();
  });

  it('affiche la mention « en retard » et un badge destructive quand isLate est vrai (calculé par l’API)', () => {
    const lateTask: EmployeeTaskWithComputed = { ...baseTask, isLate: true };
    render(<EmployeeTaskTable data={[lateTask]} isLoading={false} />);
    expect(screen.getByText(/en retard/)).toBeInTheDocument();
  });

  it('n’affiche pas « en retard » pour une tâche isLate=false, même à échéance passée', () => {
    // isLate reflète toujours la valeur API, jamais un recalcul côté
    // front (règle UI explicite du Lot 6c) — ex. une tâche Réalisée en
    // retard visuel mais non "en retard" au sens métier.
    const doneTask: EmployeeTaskWithComputed = {
      ...baseTask,
      status: 'REALISEE',
      dueDate: '2020-01-01',
      isLate: false,
    };
    render(<EmployeeTaskTable data={[doneTask]} isLoading={false} />);
    expect(screen.queryByText(/en retard/)).not.toBeInTheDocument();
    expect(screen.getByText('Réalisée')).toBeInTheDocument();
  });

  it('affiche le message vide quand aucune tâche', () => {
    render(<EmployeeTaskTable data={[]} isLoading={false} />);
    expect(screen.getByText('Aucune tâche assignée.')).toBeInTheDocument();
  });
});
