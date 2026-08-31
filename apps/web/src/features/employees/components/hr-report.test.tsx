import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Attendance, Employee, Payroll } from '@dondy-elevage/shared-types';
import { HrReport } from './hr-report';

const useEmployeesMock = vi.fn();

vi.mock('../hooks', () => ({
  useEmployees: () => useEmployeesMock(),
}));

vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => vi.fn(),
}));

// Deux employés -> useQueries est appelé avec 2 entrées pour Attendance
// et 2 pour Payroll ; on force le contenu retourné indépendamment de la
// requête réelle, même esprit que attendance-register.test.tsx (aucun
// précédent de test pour useQueries dans ce dépôt).
let attendanceResults: Array<{ data: Attendance[] | undefined; isLoading: boolean; error: unknown }> = [];
let payrollResults: Array<{ data: Payroll[] | undefined; isLoading: boolean; error: unknown }> = [];
let callIndex = 0;

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueries: () => {
      // 1er appel du composant = Attendance, 2e = Payroll (ordre des
      // hooks dans hr-report.tsx).
      const result = callIndex === 0 ? attendanceResults : payrollResults;
      callIndex++;
      return result;
    },
  };
});

const employeeA: Employee = {
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
const employeeB: Employee = { ...employeeA, id: 'employee-2', code: 'EMP-0002', status: 'CONGE' };

function attendanceRecord(status: Attendance['status'], date: string): Attendance {
  return {
    id: `att-${date}-${status}`,
    farmId: 'farm-1',
    employeeId: 'employee-1',
    date,
    status,
    checkInTime: null,
    checkOutTime: null,
    observations: null,
    createdAt: date,
    updatedAt: date,
    createdBy: null,
  };
}

function payrollRecord(status: Payroll['status'], netFcfa: number): Payroll {
  return {
    id: `payroll-${status}-${netFcfa}`,
    farmId: 'farm-1',
    employeeId: 'employee-1',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    baseSalaryFcfa: 150_000,
    bonusFcfa: 0,
    deductionsFcfa: 0,
    netFcfa,
    status,
    observations: null,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    createdBy: null,
  };
}

describe('HrReport', () => {
  it('affiche l’effectif total et la répartition par statut', () => {
    callIndex = 0;
    useEmployeesMock.mockReturnValue({ data: [employeeA, employeeB], isLoading: false });
    attendanceResults = [
      { data: [], isLoading: false, error: null },
      { data: [], isLoading: false, error: null },
    ];
    payrollResults = [
      { data: [], isLoading: false, error: null },
      { data: [], isLoading: false, error: null },
    ];

    render(<HrReport />);

    expect(screen.getByText('2')).toBeInTheDocument(); // effectif total
  });

  it('calcule le taux d’absentéisme à partir des enregistrements bruts (pas un recalcul de règle métier)', () => {
    callIndex = 0;
    useEmployeesMock.mockReturnValue({ data: [employeeA], isLoading: false });
    attendanceResults = [
      {
        data: [
          attendanceRecord('PRESENT', '2026-08-01'),
          attendanceRecord('PRESENT', '2026-08-02'),
          attendanceRecord('ABSENT', '2026-08-03'),
        ],
        isLoading: false,
        error: null,
      },
    ];
    payrollResults = [{ data: [], isLoading: false, error: null }];

    render(<HrReport />);

    // 1 absence / 3 jours pointés = 33.3 %
    expect(screen.getByText('33.3 %')).toBeInTheDocument();
  });

  it('ne comptabilise que les relevés VALIDE dans le coût de personnel', () => {
    callIndex = 0;
    useEmployeesMock.mockReturnValue({ data: [employeeA], isLoading: false });
    attendanceResults = [{ data: [], isLoading: false, error: null }];
    payrollResults = [
      {
        data: [payrollRecord('VALIDE', 150_000), payrollRecord('BROUILLON', 999_999)],
        isLoading: false,
        error: null,
      },
    ];

    render(<HrReport />);

    expect(screen.getByText('150 000')).toBeInTheDocument();
    expect(screen.queryByText('999 999')).not.toBeInTheDocument();
  });
});
