import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AssetWithComputed } from '@dondy-elevage/shared-types';
import { AssetForm } from './asset-form';

vi.mock('../hooks', () => ({
  useCreateAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/shared/entity-select', () => ({
  SupplierSelect: () => null,
  UserSelect: () => null,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const asset: AssetWithComputed = {
  id: 'asset-1',
  farmId: 'farm-1',
  code: 'PAT-0001',
  designation: 'Forage principal',
  category: 'eau',
  brand: null,
  model: null,
  serialNumber: null,
  supplierId: null,
  purchaseDate: '2026-01-01',
  serviceDate: '2026-01-05',
  purchasePriceFcfa: 1_000_000,
  installationCostFcfa: 0,
  location: null,
  responsibleId: 'user-1',
  status: 'ACTIF',
  warrantyExpiresAt: null,
  residualValueFcfa: 0,
  depreciationMethod: 'LINEAIRE',
  depreciationDurationYears: 10,
  reformDate: null,
  reformReason: null,
  observations: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  totalAcquisitionCostFcfa: 1_000_000,
  accumulatedDepreciationFcfa: 0,
  netBookValueFcfa: 1_000_000,
  tcoFcfa: 0,
};

describe('AssetForm (édition)', () => {
  it('ne propose jamais « Réformé » comme option du statut', () => {
    render(<AssetForm asset={asset} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Statut' }));

    expect(screen.getByRole('option', { name: 'Actif' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hors service' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Réformé' })).not.toBeInTheDocument();
  });
});
