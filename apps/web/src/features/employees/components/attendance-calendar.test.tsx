import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Attendance } from '@dondy-elevage/shared-types';
import { AttendanceCalendar } from './attendance-calendar';

const NOW = new Date('2026-08-15T12:00:00.000Z');

const useEmployeeAttendanceMock = vi.fn();

vi.mock('../hooks', () => ({
  useEmployeeAttendance: (id: string) => useEmployeeAttendanceMock(id),
  useCreateAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

let canEnabled = true;
vi.mock('@/components/shared/permission-gate', () => ({
  Can: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) =>
    canEnabled ? <>{children}</> : <>{fallback ?? null}</>,
}));

const record: Attendance = {
  id: 'attendance-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  date: '2026-08-15',
  status: 'PRESENT',
  checkInTime: '07:00',
  checkOutTime: '16:00',
  observations: null,
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
  createdBy: 'user-1',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  canEnabled = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AttendanceCalendar', () => {
  it('affiche « Chargement… » tant que l’historique n’est pas disponible', () => {
    useEmployeeAttendanceMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<AttendanceCalendar employeeId="employee-1" />);
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });

  it('affiche un badge de statut sur le jour d’un enregistrement existant (rôle avec accès écriture)', () => {
    useEmployeeAttendanceMock.mockReturnValue({ data: [record], isLoading: false });
    render(<AttendanceCalendar employeeId="employee-1" />);
    expect(screen.getByText('Présent')).toBeInTheDocument();
  });

  it('n’affiche aucun jour cliquable pour un rôle en lecture seule (Comptable/Lecteur)', () => {
    canEnabled = false;
    useEmployeeAttendanceMock.mockReturnValue({ data: [record], isLoading: false });
    render(<AttendanceCalendar employeeId="employee-1" />);
    // Le badge reste visible (fallback de Can), mais le jour n'est pas un
    // bouton cliquable — pas d'accès en écriture au pointage.
    expect(screen.getByText('Présent')).toBeInTheDocument();
    expect(screen.getByText('15').closest('button')).toBeNull();
  });

  it('ouvre le dialogue de pointage au clic sur un jour (rôle avec accès écriture)', () => {
    useEmployeeAttendanceMock.mockReturnValue({ data: [], isLoading: false });
    render(<AttendanceCalendar employeeId="employee-1" />);

    const dayButton = screen.getByText('15').closest('button');
    expect(dayButton).not.toBeNull();
    fireEvent.click(dayButton!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
