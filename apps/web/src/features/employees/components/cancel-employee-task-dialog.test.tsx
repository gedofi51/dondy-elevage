import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CancelEmployeeTaskDialog } from './cancel-employee-task-dialog';

const cancelMutateAsync = vi.fn().mockResolvedValue({ id: 'task-1', status: 'ANNULEE' });

vi.mock('../hooks', () => ({
  useCancelEmployeeTask: () => ({ mutateAsync: cancelMutateAsync, isPending: false }),
}));

describe('CancelEmployeeTaskDialog', () => {
  it('refuse la soumission sans motif (motif obligatoire, règle UI Lot 6c)', async () => {
    render(
      <CancelEmployeeTaskDialog
        employeeId="employee-1"
        taskId="task-1"
        open
        onOpenChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));

    expect(await screen.findByText('Motif requis')).toBeInTheDocument();
    expect(cancelMutateAsync).not.toHaveBeenCalled();
  });

  it('annule la tâche (POST /annuler) une fois un motif renseigné', async () => {
    render(
      <CancelEmployeeTaskDialog
        employeeId="employee-1"
        taskId="task-1"
        open
        onOpenChange={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Employé en congé maladie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));

    await waitFor(() => expect(cancelMutateAsync).toHaveBeenCalledTimes(1));
    expect(cancelMutateAsync.mock.calls[0]?.[0]).toMatchObject({
      cancelReason: 'Employé en congé maladie',
    });
  });
});
