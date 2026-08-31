import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Attendance, EmployeeRosterEntry } from '@dondy-elevage/shared-types';
import { AttendanceRegister } from './attendance-register';

const useEmployeeRosterMock = vi.fn();

vi.mock('../hooks', () => ({
  useEmployeeRoster: () => useEmployeeRosterMock(),
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

const activeRosterEntry: EmployeeRosterEntry = {
  id: 'employee-1',
  code: 'EMP-0001',
  name: 'Jean Koyamba',
  status: 'ACTIF',
};

beforeEach(() => {
  canEnabled = true;
});

describe('AttendanceRegister', () => {
  // Le registre affiche désormais tel quel ce que renvoie
  // useEmployeeRoster() (Lot 7-correctif) — le filtrage des statuts
  // SUSPENDU/DEPART est devenu la responsabilité du serveur
  // (RESTRICTED_EMPLOYEE_STATUSES, GET /employees/roster), pas du
  // composant. Ce test documente ce report de responsabilité plutôt que
  // de re-tester un filtrage qui n'existe plus ici.
  it('affiche tel quel les employés renvoyés par useEmployeeRoster (filtrage désormais côté serveur)', () => {
    useEmployeeRosterMock.mockReturnValue({ data: [activeRosterEntry], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.getByText('EMP-0001 — Jean Koyamba')).toBeInTheDocument();
  });

  // « Toujours vide pour un rôle sans permission » : si useEmployeeRoster
  // échoue (403 — un rôle sans EMPLOYEES_READ/ATTENDANCE_READ/
  // EMPLOYEE_TASKS_READ), la query se résout avec data=undefined ; le
  // registre reste vide plutôt que de planter — même comportement que
  // n'importe quelle liste vide, aucune UI d'erreur dédiée nécessaire
  // (rôle sans accès à /pointage de toute façon, voir nav-items.ts).
  it('reste vide (pas de crash) quand useEmployeeRoster échoue (rôle sans permission)', () => {
    useEmployeeRosterMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    queriesResult = [];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.getByText('Aucun employé actif.')).toBeInTheDocument();
  });

  it('affiche « Non pointé » et un bouton « Pointer » quand aucun enregistrement n’existe pour la date', () => {
    useEmployeeRosterMock.mockReturnValue({ data: [activeRosterEntry], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.getByText('Non pointé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pointer' })).toBeInTheDocument();
  });

  it('affiche le statut existant et un bouton « Modifier » quand un pointage existe déjà (registre fonctionnel, ex. Responsable élevage)', () => {
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
    useEmployeeRosterMock.mockReturnValue({ data: [activeRosterEntry], isLoading: false });
    queriesResult = [{ data: record, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.getByText('Présent')).toBeInTheDocument();
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });

  it('masque les boutons Pointer/Modifier pour un rôle en lecture seule (Comptable/Lecteur)', () => {
    canEnabled = false;
    useEmployeeRosterMock.mockReturnValue({ data: [activeRosterEntry], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    expect(screen.queryByRole('button', { name: 'Pointer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
  });

  it('ouvre le dialogue de pointage au clic sur « Pointer »', () => {
    useEmployeeRosterMock.mockReturnValue({ data: [activeRosterEntry], isLoading: false });
    queriesResult = [{ data: null, isLoading: false }];
    render(<AttendanceRegister date="2026-08-31" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pointer' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
