import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Payroll, SalaryAdvance } from '@dondy-elevage/shared-types';
import { PayrollTab } from './payroll-tab';

const useEmployeePayrollMock = vi.fn();
const useSalaryAdvancesMock = vi.fn();
const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'payroll-1', status: 'VALIDE' });

vi.mock('../hooks', () => ({
  useEmployeePayroll: (id: string) => useEmployeePayrollMock(id),
  useSalaryAdvances: (id: string) => useSalaryAdvancesMock(id),
  useUpdatePayroll: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
  useCreatePayroll: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSalaryAdvance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Ce fichier teste le fonctionnement de PayrollTab (transitions,
// rendu) — pas le masquage par rôle, qui vit exclusivement au niveau
// du gate <Can permission={PAYROLL_READ}> autour du montage de ce
// composant (voir employee-detail-view.test.tsx, test dédié de
// non-fuite du salaire).
vi.mock('@/components/shared/permission-gate', () => ({
  Can: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const draftPayroll: Payroll = {
  id: 'payroll-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  baseSalaryFcfa: 150_000,
  bonusFcfa: 0,
  deductionsFcfa: 0,
  netFcfa: 150_000,
  status: 'BROUILLON',
  observations: null,
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
  createdBy: 'user-1',
};

const validatedPayroll: Payroll = { ...draftPayroll, id: 'payroll-2', status: 'VALIDE' };

const pendingAdvance: SalaryAdvance = {
  id: 'advance-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  deductedInPayrollId: null,
  date: '2026-08-10',
  amountFcfa: 20_000,
  observations: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  createdBy: 'user-1',
};

const deductedAdvance: SalaryAdvance = {
  ...pendingAdvance,
  id: 'advance-2',
  deductedInPayrollId: 'payroll-2',
};

beforeEach(() => {
  vi.clearAllMocks();
  updateMutateAsync.mockResolvedValue({ id: 'payroll-1', status: 'VALIDE' });
});

describe('PayrollTab', () => {
  it('propose Modifier/Valider pour un relevé BROUILLON, aucune action pour un relevé VALIDE', () => {
    useEmployeePayrollMock.mockReturnValue({ data: [draftPayroll, validatedPayroll], isLoading: false });
    useSalaryAdvancesMock.mockReturnValue({ data: [], isLoading: false });

    render(<PayrollTab employeeId="employee-1" />);

    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument();
  });

  it('valide un relevé (PATCH status=VALIDE) après confirmation', async () => {
    useEmployeePayrollMock.mockReturnValue({ data: [draftPayroll], isLoading: false });
    useSalaryAdvancesMock.mockReturnValue({ data: [], isLoading: false });

    render(<PayrollTab employeeId="employee-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync.mock.calls[0]?.[0]).toEqual({ status: 'VALIDE' });
  });

  it('reflète le statut par avance (en attente / déduite) sans jamais afficher de solde agrégé', () => {
    useEmployeePayrollMock.mockReturnValue({ data: [validatedPayroll], isLoading: false });
    useSalaryAdvancesMock.mockReturnValue({ data: [pendingAdvance, deductedAdvance], isLoading: false });

    render(<PayrollTab employeeId="employee-1" />);

    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText(/Déduite/)).toBeInTheDocument();
    // Aucune ligne "Total"/"Solde" agrégée — jamais recalculé côté front
    // (interdiction explicite du Lot 6d).
    expect(screen.queryByText(/^Solde/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Total/)).not.toBeInTheDocument();
  });
});
