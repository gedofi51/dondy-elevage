import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Alert, BroilerBatchWithComputed } from '@dondy-elevage/shared-types';
import {
  DashboardGrowthChartCard,
  selectFeaturedBroilerBatch,
} from './dashboard-growth-chart-card';

const useDailyRecordsMock = vi.fn();
vi.mock('@/features/broiler-batches/hooks', () => ({
  useDailyRecords: (...args: unknown[]) => useDailyRecordsMock(...args),
}));

function makeBatch(overrides: Partial<BroilerBatchWithComputed> = {}): BroilerBatchWithComputed {
  return {
    id: 'b1',
    farmId: 'farm-1',
    code: 'A-14',
    breed: null,
    arrivalDate: '2026-08-01T00:00:00.000Z',
    arrivalTime: null,
    origin: 'ACHAT',
    supplierId: null,
    invoiceNumber: null,
    orderedQuantity: 1000,
    receivedQuantity: 1000,
    deadOnArrivalQuantity: 0,
    unitPriceFcfa: 500,
    transportCostFcfa: 0,
    otherCostsFcfa: 0,
    buildingId: 'building-1',
    primaryManagerId: 'user-1',
    plannedSaleDate: '2026-09-15T00:00:00.000Z',
    status: 'EN_CROISSANCE',
    observations: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    createdBy: null,
    startedQuantity: 1000,
    chickCostFcfa: 500_000,
    totalAcquisitionCostFcfa: 500_000,
    currentHeadcount: 980,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    farmId: 'farm-1',
    type: 'batch_high_mortality_j18',
    severity: 'CRITIQUE',
    entityType: 'broiler_batch',
    entityId: 'b1',
    title: 'Mortalité élevée',
    message: '',
    status: 'TRIGGERED',
    acknowledgedAt: null,
    scheduledAt: null,
    triggeredAt: null,
    acknowledgedBy: null,
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useDailyRecordsMock.mockReturnValue({ data: [] });
});

describe('selectFeaturedBroilerBatch', () => {
  it('choisit la bande référencée par une alerte active plutôt que la plus récente', () => {
    const old = makeBatch({ id: 'old', code: 'A-10', arrivalDate: '2026-07-01T00:00:00.000Z' });
    const recent = makeBatch({ id: 'recent', code: 'A-16', arrivalDate: '2026-08-20T00:00:00.000Z' });
    const alerted = makeBatch({ id: 'alerted', code: 'A-15', arrivalDate: '2026-08-05T00:00:00.000Z' });
    const result = selectFeaturedBroilerBatch(
      [old, recent, alerted],
      [makeAlert({ entityId: 'alerted' })],
    );
    expect(result?.id).toBe('alerted');
  });

  it('à défaut d’alerte, choisit la bande active arrivée le plus récemment', () => {
    const old = makeBatch({ id: 'old', arrivalDate: '2026-07-01T00:00:00.000Z' });
    const recent = makeBatch({ id: 'recent', arrivalDate: '2026-08-20T00:00:00.000Z' });
    const result = selectFeaturedBroilerBatch([old, recent], []);
    expect(result?.id).toBe('recent');
  });

  it('ignore les alertes qui ne concernent pas une bande de chair', () => {
    const batch = makeBatch();
    const result = selectFeaturedBroilerBatch(
      [batch],
      [makeAlert({ entityType: 'layer_batch', entityId: batch.id })],
    );
    expect(result?.id).toBe(batch.id); // repli sur "plus récente", pas de crash
  });

  it('aucune bande active : undefined, jamais une bande inventée', () => {
    expect(selectFeaturedBroilerBatch([], [])).toBeUndefined();
  });
});

describe('DashboardGrowthChartCard', () => {
  it('affiche un état explicite sans bande de chair active', () => {
    render(<DashboardGrowthChartCard broilerBatches={[]} alerts={[]} />);
    expect(screen.getByText('Aucune bande de chair active pour le moment.')).toBeInTheDocument();
  });

  it('affiche la bande mise en avant et sa courbe réelle', () => {
    useDailyRecordsMock.mockReturnValue({
      data: [
        { dayNumber: 1, averageWeightG: 45 },
        { dayNumber: 28, averageWeightG: 1200 },
      ],
    });
    render(<DashboardGrowthChartCard broilerBatches={[makeBatch()]} alerts={[]} />);
    expect(screen.getByText(/Bande A-14 \(chair\)/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Courbe de croissance/ })).toBeInTheDocument();
  });
});
