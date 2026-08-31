import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Attendance, Employee } from '@dondy-elevage/shared-types';
import { AttendanceRegister } from './attendance-register';

const useEmployeesMock = vi.fn();

vi.mock('../hooks', () => ({
  useEmployees: () => useEmployeesMock(),
  useCreateAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Le registre interroge une date par employé via useQueries (pas de
// hook '../hooks' dédié — voir le commentaire dans attendance-register.tsx)
// : on mock useQueries lui-même plutôt que de monter un vrai
// QueryClientProvider + fetch réseau simulé, même esprit que le mock de
// '../hooks' ailleurs dans ce module (aucun précédent de test pour
// useQueries dans ce dépôt — broiler-batches/layer-batches l'utilisent
// mais ne sont eux-mêmes testés nulle part).
let queriesResult: Array<{ data: Attendance | null | undefined; isLoading: boolean }> = [];
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueries: () => queriesResult };
});

vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => vi.fn(),
}));

let canEnabled = true;
vi.mock('@/components/shared/permission-gate', () => ({
  Can: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) =>
    canEnabled ? <>{children}</> : <>{fallback ?? null}</>,
}));

const activeEmployee: Employee = {
  id: 'employee-1',
  farmId: 'farm-1',
  code: 'EMP-0001',
  buildingId: null,
  managerId: null,
  name: 'Jean Koyamba',
  position: 'Chef d’élevage',
  contractType: null,
  phone: null,
  hireDate: '2026-01-01',
  endDate: null,
  status: 'ACTIF',
  baseSalaryFcfa: 150_000,
  observations: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  deletedAt: null,
};

const suspendedEmployee: Employee = { ...activeEmployee, id: 'employee-2', code: 'EMP-0002', status: 'SUSPENDU' };

beforeEach(() => {
  canEnabled = true;
});

describe('AttendanceRegister', () => {
  it('exclut les employés suspendus/sortis du registre (même règle que la création API)', () => {
    useEmployeesMock.mockReturnValue({ data: [activeEmployee, suspendedEmployee], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.getByText('EMP-0001 — Jean Koyamba')).toBeInTheDocument();
    expect(screen.queryByText(/EMP-0002/)).not.toBeInTheDocument();
  });

  it('affiche « Non pointé » et un bouton « Pointer » quand aucun enregistrement n’existe pour la date', () => {
    useEmployeesMock.mockReturnValue({ data: [activeEmployee], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.getByText('Non pointé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pointer' })).toBeInTheDocument();
  });

  it('affiche le statut existant et un bouton « Modifier » quand un pointage existe déjà', () => {
    const record: Attendance = {
      id: 'attendance-1',
      farmId: 'farm-1',
      employeeId: 'employee-1',
      date: '2026-08-31',
      status: 'PRESENT',
      checkInTime: '07:00',
      checkOutTime: null,
      observations: null,
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z',
      createdBy: 'user-1',
    };
    useEmployeesMock.mockReturnValue({ data: [activeEmployee], isLoading: false });
    queriesResult = [{ data: record, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.getByText('Présent')).toBeInTheDocument();
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });

  it('masque les boutons Pointer/Modifier pour un rôle en lecture seule (Comptable/Lecteur)', () => {
    canEnabled = false;
    useEmployeesMock.mockReturnValue({ data: [activeEmployee], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.queryByRole('button', { name: 'Pointer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
  });

  it('ouvre le dialogue de pointage au clic sur « Pointer »', () => {
    useEmployeesMock.mockReturnValue({ data: [activeEmployee], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pointer' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
