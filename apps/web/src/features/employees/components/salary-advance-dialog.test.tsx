import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SalaryAdvanceDialog } from './salary-advance-dialog';

const createMutateAsync = vi.fn().mockResolvedValue({ id: 'advance-1' });

vi.mock('../hooks', () => ({
  useCreateSalaryAdvance: () => ({ mutateAsync: createMutateAsync, isPending: false }),
}));

describe('SalaryAdvanceDialog', () => {
  it('affiche une erreur de validation si le montant est vide', async () => {
    render(<SalaryAdvanceDialog employeeId="employee-1" open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('Montant (FCFA)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’avance' }));

    expect(await screen.findByText('Doit être positif')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('crée une avance (POST) via useCreateSalaryAdvance', async () => {
    render(<SalaryAdvanceDialog employeeId="employee-1" open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('Montant (FCFA)'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’avance' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ amountFcfa: 20_000 });
  });
});
