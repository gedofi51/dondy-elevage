import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Employee } from '@dondy-elevage/shared-types';
import { EmployeeDetailView } from './employee-detail-view';

const useEmployeeMock = vi.fn();

vi.mock('@/features/employees/hooks', () => ({
  useEmployee: (id: string) => useEmployeeMock(id),
  useEmployees: () => ({ data: [] }),
  useDeleteEmployee: () => ({ mutateAsync: vi.fn() }),
  // Onglet Présence (Lot 6b) : AttendanceCalendar appelle ce hook dès le
  // rendu — pas l'objet de ce test (voir attendance-calendar.test.tsx),
  // juste éviter un crash "not a function" faute d'export mocké.
  useEmployeeAttendance: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/features/buildings/hooks', () => ({
  useBuildings: () => ({ data: [] }),
}));
vi.mock('@/components/shared/permission-gate', () => ({
  // Simule un rôle avec toutes les permissions Personnel (pas l'objet du
  // test ici — voir employee-form.test.tsx pour le masquage lui-même).
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const baseEmployee: Employee = {
  id: 'employee-1',
  farmId: 'farm-1',
  code: 'EMP-0001',
  buildingId: null,
  managerId: null,
  name: 'Jean Koyamba',
  position: 'Chef d’élevage',
  contractType: 'CDI',
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

describe('EmployeeDetailView', () => {
  it('affiche « Chargement… » tant que la fiche n’est pas disponible', () => {
    useEmployeeMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<EmployeeDetailView employeeId="employee-1" />);
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });

  it('affiche le salaire quand baseSalaryFcfa est présent', () => {
    useEmployeeMock.mockReturnValue({ data: baseEmployee, isLoading: false });
    render(<EmployeeDetailView employeeId="employee-1" />);
    expect(screen.getByText('Salaire de base')).toBeInTheDocument();
    expect(screen.getByText('150 000 FCFA')).toBeInTheDocument();
  });

  it('n’affiche aucune ligne salaire quand baseSalaryFcfa est absent (rôle sans accès)', () => {
    useEmployeeMock.mockReturnValue({
      data: { ...baseEmployee, baseSalaryFcfa: undefined },
      isLoading: false,
    });
    render(<EmployeeDetailView employeeId="employee-1" />);
    expect(screen.queryByText('Salaire de base')).not.toBeInTheDocument();
  });
});
