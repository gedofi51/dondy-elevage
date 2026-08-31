import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { EmployeeTaskWithComputed } from '@dondy-elevage/shared-types';
import { EmployeeTaskForm } from './employee-task-form';

const createMutateAsync = vi.fn().mockResolvedValue({ id: 'task-1' });
const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'task-1' });

vi.mock('../hooks', () => ({
  useCreateEmployeeTask: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateEmployeeTask: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const existingTask: EmployeeTaskWithComputed = {
  id: 'task-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  designation: 'Nettoyer le bâtiment A',
  dueDate: '2026-08-20',
  status: 'EN_COURS',
  cancelReason: null,
  observations: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  createdBy: 'user-1',
  isLate: false,
};

describe('EmployeeTaskForm (création — pas de tâche fournie)', () => {
  it('affiche des erreurs de validation si les champs requis sont vides', async () => {
    render(<EmployeeTaskForm employeeId="employee-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    expect(await screen.findByText('Désignation requise')).toBeInTheDocument();
    expect(screen.getByText('Échéance requise')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('crée une tâche (POST) via useCreateEmployeeTask', async () => {
    render(<EmployeeTaskForm employeeId="employee-1" />);

    fireEvent.change(screen.getByLabelText('Désignation'), { target: { value: 'Réparer la clôture' } });
    fireEvent.change(screen.getByLabelText('Échéance'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync).not.toHaveBeenCalled();
    const payload = createMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ designation: 'Réparer la clôture', dueDate: '2026-09-01' });
  });

  it('protège contre la double soumission', async () => {
    render(<EmployeeTaskForm employeeId="employee-1" />);

    fireEvent.change(screen.getByLabelText('Désignation'), { target: { value: 'Réparer la clôture' } });
    fireEvent.change(screen.getByLabelText('Échéance'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
  });
});

describe('EmployeeTaskForm (édition — tâche fournie)', () => {
  it('pré-remplit les champs à partir de la tâche existante', () => {
    render(<EmployeeTaskForm employeeId="employee-1" task={existingTask} />);
    expect(screen.getByDisplayValue('Nettoyer le bâtiment A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-08-20')).toBeInTheDocument();
  });

  it('le sélecteur de statut ne propose jamais Annulée', () => {
    render(<EmployeeTaskForm employeeId="employee-1" task={existingTask} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Statut' }));

    expect(screen.getByRole('option', { name: 'À faire' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'En cours' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Réalisée' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Annulée' })).not.toBeInTheDocument();
  });

  it('corrige une tâche (PATCH) via useUpdateEmployeeTask', async () => {
    render(<EmployeeTaskForm employeeId="employee-1" task={existingTask} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).not.toHaveBeenCalled();
    const payload = updateMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ designation: 'Nettoyer le bâtiment A', status: 'EN_COURS' });
    // ANNULEE ne peut jamais être envoyé via ce formulaire (interdiction
    // explicite du Lot 6c).
    expect(payload?.status).not.toBe('ANNULEE');
  });
});
