import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type {
  Alert,
  BatchClosureSummary,
  BroilerBatchWithComputed,
  LayerBatchClosureSummary,
  LayerBatchWithComputed,
} from '@dondy-elevage/shared-types';
import { DashboardBatchesTable } from './dashboard-batches-table';

vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => vi.fn(),
}));

const useQueriesMock = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueries: (...args: unknown[]) => useQueriesMock(...args) };
});

function makeBroilerBatch(overrides: Partial<BroilerBatchWithComputed> = {}): BroilerBatchWithComputed {
  return {
    id: 'b1',
    farmId: 'farm-1',
    code: 'A-15',
    breed: null,
    arrivalDate: new Date().toISOString(),
    arrivalTime: null,
    origin: 'ACHAT',
    supplierId: null,
    invoiceNumber: null,
    orderedQuantity: 3100,
    receivedQuantity: 3100,
    deadOnArrivalQuantity: 0,
    unitPriceFcfa: 500,
    transportCostFcfa: 0,
    otherCostsFcfa: 0,
    buildingId: 'building-1',
    primaryManagerId: 'user-1',
    plannedSaleDate: new Date().toISOString(),
    status: 'EN_CROISSANCE',
    observations: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    startedQuantity: 3100,
    chickCostFcfa: 1_550_000,
    totalAcquisitionCostFcfa: 1_550_000,
    currentHeadcount: 3100,
    ...overrides,
  };
}

function makeLayerBatch(overrides: Partial<LayerBatchWithComputed> = {}): LayerBatchWithComputed {
  return {
    id: 'l1',
    farmId: 'farm-1',
    code: 'B-07',
    strain: null,
    entryDate: new Date().toISOString(),
    initialQuantity: 2400,
    ageAtEntryWeeks: 18,
    ageAtEntryDays: null,
    buildingId: 'building-2',
    primaryManagerId: 'user-1',
    status: 'PONTE',
    observations: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    currentHeadcount: 2400,
    ...overrides,
  };
}

function makeBroilerProfitability(overrides: Partial<BatchClosureSummary> = {}): BatchClosureSummary {
  return {
    production: { receivedQuantity: 3100, startedQuantity: 3100, cumulativeMortality: 111, soldCount: 0, cycleDurationDays: 18 },
    performance: { cumulativeMortalityRate: 3.6, finalAverageWeightG: 620, totalFeedConsumptionKg: 900, feedConversionRatio: 1.5 },
    finances: { totalExpensesFcfa: 0, revenueFcfa: 0, grossMarginFcfa: 0, profitabilityRate: 0, costPerChickProducedFcfa: 0, costPerChickSoldFcfa: 0 },
    coherence: { dailyRecordMortalityTotal: 111, detailedMortalityTotal: 111, isCoherent: true },
    ...overrides,
  };
}

function makeLayerProfitability(overrides: Partial<LayerBatchClosureSummary> = {}): LayerBatchClosureSummary {
  return {
    production: { initialQuantity: 2400, currentHeadcount: 2400, cumulativeEggsLaid: 0, cumulativeEggsSellable: 0, cumulativeEggsSold: 0, averageLayingRatePercent: 0, daysTracked: 0 },
    performance: { cumulativeMortalityRate: 0.9 },
    stock: { remainingEggStock: 0 },
    finances: { totalExpensesFcfa: 0, revenueFcfa: 0, grossMarginFcfa: 0, costPerEggFcfa: 0 },
    coherence: { lastRecordedHenCount: null, computedHeadcount: 2400, isCoherent: true },
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useQueriesMock.mockImplementation((opts: { queries: Array<{ queryKey: unknown[] }> }) => {
    if (opts.queries.length === 0) return [];
    const isLayer = opts.queries[0]!.queryKey[0] === 'layer-batches';
    return opts.queries.map(() => ({
      data: isLayer ? makeLayerProfitability() : makeBroilerProfitability(),
      isLoading: false,
    }));
  });
});

describe('DashboardBatchesTable', () => {
  it('affiche un état vide explicite sans bande active', () => {
    render(<DashboardBatchesTable broilerBatches={[]} layerBatches={[]} alerts={[]} />);
    expect(screen.getByText('Aucune bande active pour le moment.')).toBeInTheDocument();
  });

  it('combine chair et pondeuses dans un seul tableau, avec l’âge propre à chaque type', () => {
    render(
      <DashboardBatchesTable
        broilerBatches={[makeBroilerBatch()]}
        layerBatches={[makeLayerBatch()]}
        alerts={[]}
      />,
    );
    expect(screen.getByText('A-15')).toBeInTheDocument();
    expect(screen.getByText('B-07')).toBeInTheDocument();
  });

  it('mortalité élevée mise en évidence (chair), poids réel affiché', () => {
    render(
      <DashboardBatchesTable broilerBatches={[makeBroilerBatch()]} layerBatches={[]} alerts={[]} />,
    );
    const mortalityCell = screen.getByText('3,6 %');
    expect(mortalityCell).toHaveClass('text-destructive');
    expect(screen.getByText('0,62 kg')).toBeInTheDocument();
  });

  it('pondeuses : mortalité réelle affichée, poids "—" (aucune donnée réelle pour ce type)', () => {
    render(<DashboardBatchesTable broilerBatches={[]} layerBatches={[makeLayerBatch()]} alerts={[]} />);
    expect(screen.getByText('0,9 %')).toBeInTheDocument();
    // Une seule ligne -> une seule cellule "—" (Poids)
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('statut dérivé des alertes actives réelles (jamais une notion de statut fabriquée)', () => {
    render(
      <DashboardBatchesTable
        broilerBatches={[makeBroilerBatch()]}
        layerBatches={[makeLayerBatch()]}
        alerts={[makeAlert()]}
      />,
    );
    expect(screen.getByText('Critique')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument(); // B-07, aucune alerte
  });

  it('propose deux liens explicites plutôt qu’un "Voir tout" unique et arbitraire', () => {
    render(
      <DashboardBatchesTable broilerBatches={[makeBroilerBatch()]} layerBatches={[]} alerts={[]} />,
    );
    expect(screen.getByRole('link', { name: 'Chair →' })).toHaveAttribute('href', '/poulets-chair');
    expect(screen.getByRole('link', { name: 'Pondeuses →' })).toHaveAttribute('href', '/pondeuses');
  });
});
