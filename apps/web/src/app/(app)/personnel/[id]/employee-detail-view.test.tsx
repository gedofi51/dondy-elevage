import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Employee, EmployeeTaskWithComputed } from '@dondy-elevage/shared-types';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { EmployeeDetailView } from './employee-detail-view';

const useEmployeeMock = vi.fn();
const useEmployeeTasksMock = vi.fn();
// Espions dédiés (pas de simple factory inline) — le test de non-fuite
// du salaire (Lot 6d) doit pouvoir affirmer qu'ils ne sont JAMAIS
// appelés pour un rôle sans PAYROLL_READ, pas seulement que leur
// contenu n'est pas rendu.
const useEmployeePayrollMock = vi.fn();
const useSalaryAdvancesMock = vi.fn();

vi.mock('@/features/employees/hooks', () => ({
  useEmployee: (id: string) => useEmployeeMock(id),
  useEmployees: () => ({ data: [] }),
  useDeleteEmployee: () => ({ mutateAsync: vi.fn() }),
  // Onglet Présence (Lot 6b) : AttendanceCalendar appelle ce hook dès le
  // rendu — pas l'objet de ce test (voir attendance-calendar.test.tsx),
  // juste éviter un crash "not a function" faute d'export mocké.
  useEmployeeAttendance: () => ({ data: [], isLoading: false }),
  // Onglet Tâches (Lot 6c) : idem pour EmployeeTaskTable/-Form/-Dialog —
  // ce module unique est importé aussi bien directement par
  // EmployeeDetailView (via l'alias @) que par EmployeeTaskDialog/
  // CancelEmployeeTaskDialog (via '../hooks', même fichier résolu) : un
  // seul vi.mock ici couvre les deux chemins d'import.
  useEmployeeTasks: (id: string) => useEmployeeTasksMock(id),
  useCreateEmployeeTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEmployeeTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelEmployeeTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // Onglet Paie (Lot 6d) : idem, via PayrollTab (même chemin d'import
  // '../hooks' résolu que ci-dessus).
  useEmployeePayroll: (id: string) => useEmployeePayrollMock(id),
  useSalaryAdvances: (id: string) => useSalaryAdvancesMock(id),
  useUpdatePayroll: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePayroll: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSalaryAdvance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/buildings/hooks', () => ({
  useBuildings: () => ({ data: [] }),
}));

// Permission set par défaut = rôle avec accès complet Personnel (pas
// l'objet des tests salaire/chargement ci-dessous — voir
// employee-form.test.tsx pour le masquage salaire, et le describe
// « garde par rôle » plus bas pour la restriction de permissions).
let mockPermissions = new Set<string>([
  PERMISSIONS.EMPLOYEES_UPDATE,
  PERMISSIONS.EMPLOYEES_DELETE,
  PERMISSIONS.PAYROLL_READ,
  PERMISSIONS.EMPLOYEE_TASKS_CREATE,
  PERMISSIONS.EMPLOYEE_TASKS_UPDATE,
]);

vi.mock('@/components/shared/permission-gate', () => ({
  Can: ({
    children,
    permission,
    fallback,
  }: {
    children: ReactNode;
    permission: string;
    fallback?: ReactNode;
  }) => (mockPermissions.has(permission) ? <>{children}</> : <>{fallback ?? null}</>),
}));
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

beforeEach(() => {
  mockPermissions = new Set<string>([
    PERMISSIONS.EMPLOYEES_UPDATE,
    PERMISSIONS.EMPLOYEES_DELETE,
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.EMPLOYEE_TASKS_CREATE,
    PERMISSIONS.EMPLOYEE_TASKS_UPDATE,
  ]);
  useEmployeeTasksMock.mockReturnValue({ data: [], isLoading: false });
  useEmployeePayrollMock.mockClear();
  useSalaryAdvancesMock.mockClear();
  useEmployeePayrollMock.mockReturnValue({ data: [], isLoading: false });
  useSalaryAdvancesMock.mockReturnValue({ data: [], isLoading: false });
});

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

const openTask: EmployeeTaskWithComputed = {
  id: 'task-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  designation: 'Nettoyer le bâtiment A',
  dueDate: '2026-09-01',
  status: 'A_FAIRE',
  cancelReason: null,
  observations: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  createdBy: 'user-1',
  isLate: false,
};

// « Garde par rôle y compris Responsable élevage » (Lot 6c) — ce rôle a
// EMPLOYEE_TASKS_CREATE/UPDATE mais pas EMPLOYEES_UPDATE/DELETE (voir
// roles.catalog.ts) : les actions Tâches doivent rester visibles malgré
// l'absence des permissions Employee, contrairement à Comptable/Lecteur
// qui n'ont que EMPLOYEE_TASKS_READ.
describe('EmployeeDetailView — onglet Tâches, garde par rôle', () => {
  it('Responsable élevage (EMPLOYEE_TASKS_CREATE/UPDATE, pas EMPLOYEES_UPDATE) voit les actions Tâches', () => {
    mockPermissions = new Set([PERMISSIONS.EMPLOYEE_TASKS_CREATE, PERMISSIONS.EMPLOYEE_TASKS_UPDATE]);
    useEmployeeMock.mockReturnValue({ data: baseEmployee, isLoading: false });
    useEmployeeTasksMock.mockReturnValue({ data: [openTask], isLoading: false });

    render(<EmployeeDetailView employeeId="employee-1" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tâches' }));

    expect(screen.getByRole('button', { name: /Nouvelle tâche/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    // Et n'a pas les actions Employee (édition/suppression de la fiche).
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
  });

  it('Comptable/Lecteur (EMPLOYEE_TASKS_READ seul) ne voit aucune action Tâches', () => {
    mockPermissions = new Set();
    useEmployeeMock.mockReturnValue({ data: baseEmployee, isLoading: false });
    useEmployeeTasksMock.mockReturnValue({ data: [openTask], isLoading: false });

    render(<EmployeeDetailView employeeId="employee-1" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tâches' }));

    // La liste reste visible (onglet Tâches non gated, voir
    // DETTE_TECHNIQUE.md Lot 6a) — seules les actions d'écriture disparaissent.
    expect(screen.getByText('Nettoyer le bâtiment A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nouvelle tâche/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  });

  it('ne propose pas « Nouvelle tâche » pour un employé suspendu/sorti, même avec les droits d’écriture', () => {
    mockPermissions = new Set([PERMISSIONS.EMPLOYEE_TASKS_CREATE, PERMISSIONS.EMPLOYEE_TASKS_UPDATE]);
    useEmployeeMock.mockReturnValue({ data: { ...baseEmployee, status: 'SUSPENDU' }, isLoading: false });
    useEmployeeTasksMock.mockReturnValue({ data: [], isLoading: false });

    render(<EmployeeDetailView employeeId="employee-1" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tâches' }));

    expect(screen.queryByRole('button', { name: /Nouvelle tâche/ })).not.toBeInTheDocument();
    expect(screen.getByText(/aucune nouvelle tâche assignable/)).toBeInTheDocument();
  });
});

// Test dédié de non-fuite du salaire (Lot 6d, « Rappel critique ») —
// Lecteur (aucune permission Paie/Avance) : l'onglet Paie doit être
// absent du DOM (pas juste vidé de ses données), et PayrollTab (donc
// useEmployeePayroll/useSalaryAdvances) ne doit JAMAIS être monté —
// preuve directe qu'aucune requête, donc aucune entrée de cache React
// Query, n'est jamais déclenchée pour ce rôle. Un test de contrôle
// positif (rôle avec PAYROLL_READ) confirme que le montage/la donnée
// fonctionnent normalement par ailleurs — sans lui, ce test pourrait
// passer trivialement à cause d'un sélecteur cassé plutôt que d'un
// masquage réel.
describe('EmployeeDetailView — non-fuite du salaire (onglet Paie)', () => {
  it('CONTRÔLE POSITIF : un rôle avec PAYROLL_READ atteint l’onglet Paie et déclenche le chargement', () => {
    mockPermissions = new Set([PERMISSIONS.PAYROLL_READ]);
    useEmployeeMock.mockReturnValue({ data: baseEmployee, isLoading: false });

    render(<EmployeeDetailView employeeId="employee-1" />);

    expect(screen.getByRole('tab', { name: 'Paie' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Paie' }));
    expect(useEmployeePayrollMock).toHaveBeenCalledWith('employee-1');
    expect(useSalaryAdvancesMock).toHaveBeenCalledWith('employee-1');
  });

  it('Lecteur (aucune permission Paie) : onglet Paie absent du DOM, aucun hook Paie/Avance jamais appelé', () => {
    mockPermissions = new Set(); // Lecteur : ni PAYROLL_READ, ni EMPLOYEES_VIEW_SALARY, rien.
    useEmployeeMock.mockReturnValue({
      data: { ...baseEmployee, baseSalaryFcfa: undefined },
      isLoading: false,
    });

    render(<EmployeeDetailView employeeId="employee-1" />);

    // 1. Absence structurelle — pas de trigger, donc aucun moyen
    //    d'atteindre le contenu (pas un TabsContent vidé de ses données).
    expect(screen.queryByRole('tab', { name: 'Paie' })).not.toBeInTheDocument();
    expect(screen.queryByText('Relevés de paie')).not.toBeInTheDocument();
    expect(screen.queryByText('Avances sur salaire')).not.toBeInTheDocument();

    // 2. Aucune fuite via le cache React Query — PayrollTab n'étant
    //    jamais monté, ses hooks ne sont jamais invoqués.
    expect(useEmployeePayrollMock).not.toHaveBeenCalled();
    expect(useSalaryAdvancesMock).not.toHaveBeenCalled();

    // 3. Aucun champ salaire/paie/avance dans le DOM, nulle part sur la
    //    fiche (pas seulement dans l'onglet Paie).
    expect(screen.queryByText('Salaire de base')).not.toBeInTheDocument();
    expect(screen.queryByText(/FCFA/)).not.toBeInTheDocument();
  });
});
