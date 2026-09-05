import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  BatchPerformanceScore,
  LayerBatchClosureSummary,
  LayerBatchWithComputed,
} from '@dondy-elevage/shared-types';
import { LayerComparison } from './layer-comparison';

const useLayerBatchesMock = vi.fn();
vi.mock('@/features/layer-batches/hooks', () => ({
  useLayerBatches: () => useLayerBatchesMock(),
}));

vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => vi.fn(),
}));

// <Can permission={FARMS_UPDATE}> (Lot 5, formulaire de coefficients) exige
// AuthProvider — mock direct de `Can`, même patron que
// attendance-register.test.tsx/broiler-comparison.test.tsx. Désactivé par
// défaut : sa couverture vit dans
// layer-batches/components/performance-coefficients-form.test.tsx.
let canEnabled = false;
vi.mock('@/components/shared/permission-gate', () => ({
  Can: ({ children }: { children: ReactNode }) => (canEnabled ? <>{children}</> : null),
}));

// Deux appels useQueries (rentabilité, score de performance Lot 5)
// partagent le même tableau — makeSummary() porte donc aussi `scoreOn100`,
// voir broiler-comparison.test.tsx pour le même choix.
let queriesResult: Array<{
  data: (LayerBatchClosureSummary & Pick<BatchPerformanceScore, 'scoreOn100'>) | undefined;
  isLoading: boolean;
}> = [];
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
    blockId: null,
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

function makeSummary(
  overrides: Partial<LayerBatchClosureSummary & Pick<BatchPerformanceScore, 'scoreOn100'>> = {},
): LayerBatchClosureSummary & Pick<BatchPerformanceScore, 'scoreOn100'> {
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
    performance: { cumulativeMortalityRate: 2 },
    stock: { remainingEggStock: 1500 },
    finances: { totalExpensesFcfa: 300_000, revenueFcfa: 400_000, grossMarginFcfa: 100_000, costPerEggFcfa: 15 },
    coherence: { lastRecordedHenCount: 990, computedHeadcount: 990, isCoherent: true },
    scoreOn100: 82,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queriesResult = [];
  canEnabled = false;
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
