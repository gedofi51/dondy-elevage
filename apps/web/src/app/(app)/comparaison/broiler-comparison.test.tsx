import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BatchClosureSummary, BroilerBatchWithComputed } from '@dondy-elevage/shared-types';
import { BroilerComparison } from './broiler-comparison';

const useBroilerBatchesMock = vi.fn();
vi.mock('@/features/broiler-batches/hooks', () => ({
  useBroilerBatches: () => useBroilerBatchesMock(),
}));

vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => vi.fn(),
}));

// Même patron que attendance-register.test.tsx : mock direct de
// useQueries (aucun précédent de vrai QueryClientProvider dans ce dépôt
// pour un composant basé sur useQueries).
let queriesResult: Array<{ data: BatchClosureSummary | undefined; isLoading: boolean }> = [];
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueries: () => queriesResult };
});

function makeBatch(overrides: Partial<BroilerBatchWithComputed> = {}): BroilerBatchWithComputed {
  return {
    id: 'batch-1',
    farmId: 'farm-1',
    code: 'PC-2026-001',
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
    plannedSaleDate: '2026-09-14T00:00:00.000Z',
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

function makeSummary(overrides: Partial<BatchClosureSummary> = {}): BatchClosureSummary {
  return {
    production: { receivedQuantity: 1000, startedQuantity: 1000, cumulativeMortality: 20, soldCount: 0, cycleDurationDays: 33 },
    performance: { cumulativeMortalityRate: 2, finalAverageWeightG: 1800, totalFeedConsumptionKg: 500, feedConversionRatio: 1.8 },
    finances: { totalExpensesFcfa: 500_000, revenueFcfa: 0, grossMarginFcfa: -500_000, profitabilityRate: -100, costPerChickProducedFcfa: 500, costPerChickSoldFcfa: 0 },
    coherence: { dailyRecordMortalityTotal: 20, detailedMortalityTotal: 20, isCoherent: true },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queriesResult = [];
});

describe('BroilerComparison', () => {
  it('demande de sélectionner au moins 2 bandes tant que moins de 2 sont cochées', () => {
    useBroilerBatchesMock.mockReturnValue({ data: [makeBatch(), makeBatch({ id: 'batch-2', code: 'PC-2026-002' })] });
    render(<BroilerComparison />);
    expect(screen.getByText(/Sélectionnez au moins 2 bandes/)).toBeInTheDocument();
  });

  it('affiche le tableau comparatif une fois 2 bandes cochées et leurs données chargées', () => {
    useBroilerBatchesMock.mockReturnValue({
      data: [makeBatch(), makeBatch({ id: 'batch-2', code: 'PC-2026-002' })],
    });
    queriesResult = [
      { data: makeSummary(), isLoading: false },
      { data: makeSummary({ finances: { totalExpensesFcfa: 600_000, revenueFcfa: 0, grossMarginFcfa: -600_000, profitabilityRate: -100, costPerChickProducedFcfa: 600, costPerChickSoldFcfa: 0 } }), isLoading: false },
    ];
    render(<BroilerComparison />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);

    expect(screen.getByRole('columnheader', { name: 'PC-2026-001' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'PC-2026-002' })).toBeInTheDocument();
    expect(screen.getByText('500 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('600 000 FCFA')).toBeInTheDocument();
    // Poids final identique dans les deux fixtures (1800 g) -> 2 occurrences.
    expect(screen.getAllByText('1,8 kg')).toHaveLength(2);
  });
});
