import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Payroll } from '@dondy-elevage/shared-types';
import { PayrollTable } from './payroll-table';

const basePayroll: Payroll = {
  id: 'payroll-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  baseSalaryFcfa: 150_000,
  bonusFcfa: 10_000,
  deductionsFcfa: 0,
  netFcfa: 160_000,
  status: 'BROUILLON',
  observations: null,
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
  createdBy: 'user-1',
};

describe('PayrollTable', () => {
  it('affiche la période, le net à payer et le statut', () => {
    render(<PayrollTable data={[basePayroll]} isLoading={false} />);
    expect(screen.getByText('160 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });

  it('affiche le statut Validé pour un relevé validé', () => {
    render(<PayrollTable data={[{ ...basePayroll, status: 'VALIDE' }]} isLoading={false} />);
    expect(screen.getByText('Validé')).toBeInTheDocument();
  });

  it('affiche le message vide quand aucun relevé', () => {
    render(<PayrollTable data={[]} isLoading={false} />);
    expect(screen.getByText('Aucun relevé de paie.')).toBeInTheDocument();
  });
});
