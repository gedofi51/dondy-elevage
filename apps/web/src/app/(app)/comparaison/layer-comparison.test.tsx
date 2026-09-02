import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LayerBatchClosureSummary, LayerBatchWithComputed } from '@dondy-elevage/shared-types';
import { LayerComparison } from './layer-comparison';

const useLayerBatchesMock = vi.fn();
vi.mock('@/features/layer-batches/hooks', () => ({
  useLayerBatches: () => useLayerBatchesMock(),
}));

vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => vi.fn(),
}));

let queriesResult: Array<{ data: LayerBatchClosureSummary | undefined; isLoading: boolean }> = [];
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueries: () => queriesResult };
});

function makeBatch(overrides: Partial<LayerBatchWithComputed> = {}): LayerBatchWithComputed {
  return {
    id: 'batch-1',
    farmId: 'farm-1',
    code: 'PON-2026-001',
    strain: null,
    entryDate: '2026-08-01T00:00:00.000Z',
    initialQuantity: 1000,
    ageAtEntryWeeks: 18,
    ageAtEntryDays: null,
    buildingId: 'building-1',
    primaryManagerId: 'user-1',
    status: 'PONTE',
    observations: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    createdBy: null,
    currentHeadcount: 990,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<LayerBatchClosureSummary> = {}): LayerBatchClosureSummary {
  return {
    production: {
      initialQuantity: 1000,
      currentHeadcount: 990,
      cumulativeEggsLaid: 27_000,
      cumulativeEggsSellable: 26_500,
      cumulativeEggsSold: 25_000,
      averageLayingRatePercent: 90,
      daysTracked: 30,
    },
    stock: { remainingEggStock: 1500 },
    finances: { totalExpensesFcfa: 300_000, revenueFcfa: 400_000, grossMarginFcfa: 100_000, costPerEggFcfa: 15 },
    coherence: { lastRecordedHenCount: 990, computedHeadcount: 990, isCoherent: true },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queriesResult = [];
});

describe('LayerComparison', () => {
  it('demande de sélectionner au moins 2 lots tant que moins de 2 sont cochés', () => {
    useLayerBatchesMock.mockReturnValue({ data: [makeBatch(), makeBatch({ id: 'batch-2', code: 'PON-2026-002' })] });
    render(<LayerComparison />);
    expect(screen.getByText(/Sélectionnez au moins 2 lots/)).toBeInTheDocument();
  });

  it('affiche le tableau comparatif une fois 2 lots cochés', () => {
    useLayerBatchesMock.mockReturnValue({
      data: [makeBatch(), makeBatch({ id: 'batch-2', code: 'PON-2026-002' })],
    });
    queriesResult = [
      { data: makeSummary(), isLoading: false },
      { data: makeSummary({ production: { ...makeSummary().production, averageLayingRatePercent: 85 } }), isLoading: false },
    ];
    render(<LayerComparison />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);

    expect(screen.getByRole('columnheader', { name: 'PON-2026-001' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'PON-2026-002' })).toBeInTheDocument();
    expect(screen.getByText('90.0 %')).toBeInTheDocument();
    expect(screen.getByText('85.0 %')).toBeInTheDocument();
  });
});
