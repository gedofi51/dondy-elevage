import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Payroll } from '@dondy-elevage/shared-types';
import { PayrollForm } from './payroll-form';

const createMutateAsync = vi.fn().mockResolvedValue({ id: 'payroll-1' });
const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'payroll-1' });

vi.mock('../hooks', () => ({
  useCreatePayroll: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdatePayroll: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const existingPayroll: Payroll = {
  id: 'payroll-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  baseSalaryFcfa: 150_000,
  bonusFcfa: 10_000,
  deductionsFcfa: 5_000,
  netFcfa: 155_000,
  status: 'BROUILLON',
  observations: null,
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
  createdBy: 'user-1',
};

describe('PayrollForm (création — pas de relevé fourni)', () => {
  it('affiche des erreurs de validation si les dates de période sont vides', async () => {
    render(<PayrollForm employeeId="employee-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Créer le relevé' }));

    expect(await screen.findByText('Date de début requise')).toBeInTheDocument();
    expect(screen.getByText('Date de fin requise')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('refuse une fin de période antérieure au début', async () => {
    render(<PayrollForm employeeId="employee-1" />);

    fireEvent.change(screen.getByLabelText('Début de période'), { target: { value: '2026-08-31' } });
    fireEvent.change(screen.getByLabelText('Fin de période'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le relevé' }));

    expect(
      await screen.findByText('La date de fin de période ne peut pas précéder la date de début.'),
    ).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('crée un relevé (POST) via useCreatePayroll', async () => {
    render(<PayrollForm employeeId="employee-1" />);

    fireEvent.change(screen.getByLabelText('Début de période'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Fin de période'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le relevé' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync).not.toHaveBeenCalled();
    const payload = createMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ periodStart: '2026-08-01', periodEnd: '2026-08-31' });
  });
});

describe('PayrollForm (édition — relevé BROUILLON fourni)', () => {
  it('ne propose aucun champ période (immuable après création)', () => {
    render(<PayrollForm employeeId="employee-1" payroll={existingPayroll} />);
    expect(screen.queryByLabelText('Début de période')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fin de période')).not.toBeInTheDocument();
  });

  it('pré-remplit prime/retenues et corrige (PATCH) via useUpdatePayroll', async () => {
    render(<PayrollForm employeeId="employee-1" payroll={existingPayroll} />);

    expect(screen.getByDisplayValue('10000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).not.toHaveBeenCalled();
    const payload = updateMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ bonusFcfa: 10_000, deductionsFcfa: 5_000 });
    // Jamais de statut envoyé depuis ce formulaire — la validation est une
    // action séparée (voir payroll-tab.tsx, ConfirmDialog dédié).
    expect(payload?.status).toBeUndefined();
  });
});
