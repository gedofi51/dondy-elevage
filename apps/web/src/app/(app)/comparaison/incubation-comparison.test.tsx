import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  BatchPerformanceScore,
  IncubationBatchProfitability,
  IncubationBatchWithComputed,
} from '@dondy-elevage/shared-types';
import { IncubationComparison } from './incubation-comparison';

const useIncubationBatchesMock = vi.fn();
vi.mock('@/features/incubation-batches/hooks', () => ({
  useIncubationBatches: () => useIncubationBatchesMock(),
}));

vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => vi.fn(),
}));

// <Can permission={FARMS_UPDATE}> (Lot 5, formulaire de coefficients) exige
// AuthProvider — mock direct de `Can` plutôt que de useAuth, même patron
// que attendance-register.test.tsx. Désactivé par défaut : le formulaire
// d'administration (qui appelle useQuery, jamais testé avec un vrai
// QueryClientProvider dans ce dépôt) reste démonté dans les tests
// existants — sa propre couverture vit dans
// performance-coefficients-form.test.tsx.
let canEnabled = false;
vi.mock('@/components/shared/permission-gate', () => ({
  Can: ({ children }: { children: ReactNode }) => (canEnabled ? <>{children}</> : null),
}));

// IncubationComparison appelle useQueries DEUX fois (lots puis
// rentabilité) — mockReturnValueOnce dans l'ordre d'appel plutôt qu'un
// mock unique partagé (voir broiler/layer-comparison.test.tsx).
const useQueriesMock = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueries: (...args: unknown[]) => useQueriesMock(...args) };
});

function makeBatch(overrides: Partial<IncubationBatchWithComputed> = {}): IncubationBatchWithComputed {
  return {
    id: 'batch-1',
    farmId: 'farm-1',
    code: 'INC-2026-001',
    breederBatchId: 'breeder-1',
    incubatorId: 'incubator-1',
    incubationStartDate: '2026-08-01T00:00:00.000Z',
    eggCount: 500,
    actualHatchDate: '2026-08-22T00:00:00.000Z',
    eggsInfertile: 20,
    eggsInfected: 5,
    embryonicMortality: 15,
    chicksHatched: 400,
    remarks: null,
    status: 'ECLOS',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    createdBy: null,
    expectedHatchDate: '2026-08-22T00:00:00.000Z',
    expectedCandlingDate: '2026-08-08T00:00:00.000Z',
    ...overrides,
  };
}

function makeProfitability(overrides: Partial<IncubationBatchProfitability> = {}): IncubationBatchProfitability {
  return {
    totalExpensesFcfa: 200_000,
    revenueFcfa: 300_000,
    grossMarginFcfa: 100_000,
    profitabilityRate: 50,
    costPerChickHatchedFcfa: 500,
    performance: { hatchRatePercent: 78, fertilityRatePercent: 92 },
    ...overrides,
  };
}

function makeScore(overrides: Partial<BatchPerformanceScore> = {}): BatchPerformanceScore {
  return {
    scoreOn100: 80,
    dataStatus: 'SUFFISANT',
    calculatedAt: '2026-08-22T00:00:00.000Z',
    components: [
      {
        key: 'hatchRate',
        label: "Taux d'éclosion",
        rawValue: 78,
        unit: '%',
        target: null,
        weight: 0.5,
        contributionPercent: 78,
      },
      {
        key: 'fertilityRate',
        label: 'Taux de fécondité',
        rawValue: 92,
        unit: '%',
        target: null,
        weight: 0.5,
        contributionPercent: 92,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  canEnabled = false;
});

describe('IncubationComparison', () => {
  it('ne propose que les couvoirs ÉCLOS à la sélection (EN_INCUBATION exclu)', () => {
    useIncubationBatchesMock.mockReturnValue({
      data: [makeBatch(), makeBatch({ id: 'batch-2', code: 'INC-2026-002', status: 'EN_INCUBATION' })],
    });
    useQueriesMock.mockReturnValue([]);
    render(<IncubationComparison />);

    expect(screen.getByText('INC-2026-001')).toBeInTheDocument();
    expect(screen.queryByText('INC-2026-002')).not.toBeInTheDocument();
  });

  it('demande de sélectionner au moins 2 couvoirs éclos', () => {
    useIncubationBatchesMock.mockReturnValue({
      data: [makeBatch(), makeBatch({ id: 'batch-2', code: 'INC-2026-002' })],
    });
    useQueriesMock.mockReturnValue([]);
    render(<IncubationComparison />);
    expect(screen.getByText(/Sélectionnez au moins 2 couvoirs éclos/)).toBeInTheDocument();
  });

  it('affiche le taux d’éclosion recalculé une fois 2 couvoirs cochés', () => {
    useIncubationBatchesMock.mockReturnValue({
      data: [makeBatch(), makeBatch({ id: 'batch-2', code: 'INC-2026-002', chicksHatched: 350 })],
    });
    // useIncubationComparisonData appelle useQueries 3 fois (lots,
    // rentabilité, score de performance — Lot 5) à CHAQUE rendu (React
    // re-rend à chaque clic) — mockReturnValueOnce ne cible pas de façon
    // fiable le rendu final, contrairement à mockImplementation qui répond
    // selon la forme réelle des queryKeys, quel que soit le nombre de rendus.
    useQueriesMock.mockImplementation((opts: { queries: Array<{ queryKey: unknown[] }> }) => {
      if (opts.queries.length < 2) {
        return opts.queries.map(() => ({ data: undefined, isLoading: false }));
      }
      if (opts.queries[0]!.queryKey.includes('profitability')) {
        return [
          { data: makeProfitability(), isLoading: false },
          { data: makeProfitability({ costPerChickHatchedFcfa: 600 }), isLoading: false },
        ];
      }
      if (opts.queries[0]!.queryKey.includes('performance-score')) {
        return [
          { data: makeScore(), isLoading: false },
          { data: makeScore({ scoreOn100: 70 }), isLoading: false },
        ];
      }
      return [
        { data: makeBatch(), isLoading: false },
        { data: makeBatch({ id: 'batch-2', code: 'INC-2026-002', chicksHatched: 350 }), isLoading: false },
      ];
    });
    render(<IncubationComparison />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);

    // 400/500*100 = 80.0 %, 350/500*100 = 70.0 %.
    expect(screen.getByText('80.0 %')).toBeInTheDocument();
    expect(screen.getByText('70.0 %')).toBeInTheDocument();
  });
});
