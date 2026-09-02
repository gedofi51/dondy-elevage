import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BroilerBatchWithComputed, BroilerForecast } from '@dondy-elevage/shared-types';
import { BroilerForecastTable } from './broiler-forecast-table';

const useBroilerBatchesWithForecastMock = vi.fn();

vi.mock('@/features/broiler-batches/hooks', () => ({
  useBroilerBatchesWithForecast: () => useBroilerBatchesWithForecastMock(),
}));

function makeBatch(overrides: Partial<BroilerBatchWithComputed> = {}): BroilerBatchWithComputed {
  return {
    id: 'batch-1',
    farmId: 'farm-1',
    code: 'PC-2026-001',
    breed: null,
    arrivalDate: '2026-09-01T00:00:00.000Z',
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
    plannedSaleDate: '2026-10-15T00:00:00.000Z',
    status: 'EN_CROISSANCE',
    observations: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    createdBy: null,
    startedQuantity: 1000,
    chickCostFcfa: 500_000,
    totalAcquisitionCostFcfa: 500_000,
    currentHeadcount: 980,
    ...overrides,
  };
}

function makeForecast(overrides: Partial<BroilerForecast> = {}): BroilerForecast {
  return {
    batchId: 'batch-1',
    referenceStart: '2026-09-01T00:00:00.000Z',
    referenceEnd: '2026-10-15T00:00:00.000Z',
    elapsedDays: 10,
    remainingDays: 35,
    mortalityDataStatus: 'SUFFISANT',
    projectedAdditionalMortality: 70,
    projectedSellableCount: 910,
    weightDataStatus: 'SUFFISANT',
    gmqTrendGramsPerDay: 30,
    projectedFinalWeightG: 1300,
    calculatedAt: '2026-09-11T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BroilerForecastTable', () => {
  it('affiche la bande avec ses projections quand les données sont suffisantes', () => {
    useBroilerBatchesWithForecastMock.mockReturnValue({
      data: [{ batch: makeBatch(), forecast: makeForecast() }],
      isLoading: false,
    });
    render(<BroilerForecastTable />);
    expect(screen.getByText('PC-2026-001')).toBeInTheDocument();
    expect(screen.getByText('910')).toBeInTheDocument();
    expect(screen.getByText('1,3 kg')).toBeInTheDocument();
  });

  it('n’invente jamais de chiffre quand une donnée est insuffisante — affiche « — »', () => {
    useBroilerBatchesWithForecastMock.mockReturnValue({
      data: [
        {
          batch: makeBatch(),
          forecast: makeForecast({
            mortalityDataStatus: 'INSUFFISANT',
            projectedAdditionalMortality: null,
            projectedSellableCount: null,
            weightDataStatus: 'INSUFFISANT',
            gmqTrendGramsPerDay: null,
            projectedFinalWeightG: null,
          }),
        },
      ],
      isLoading: false,
    });
    render(<BroilerForecastTable />);
    expect(screen.getAllByText('Insuffisantes')).toHaveLength(2);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('affiche un état vide explicite en l’absence de bande en cours de cycle', () => {
    useBroilerBatchesWithForecastMock.mockReturnValue({ data: [], isLoading: false });
    render(<BroilerForecastTable />);
    expect(screen.getByText('Aucune bande en cours de cycle.')).toBeInTheDocument();
  });
});
