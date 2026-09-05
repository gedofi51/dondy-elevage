import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LayerBatchWithComputed, LayerForecast } from '@dondy-elevage/shared-types';
import { LayerForecastTable } from './layer-forecast-table';

const useLayerBatchesWithForecastMock = vi.fn();

vi.mock('@/features/layer-batches/hooks', () => ({
  useLayerBatchesWithForecast: () => useLayerBatchesWithForecastMock(),
}));

function makeBatch(overrides: Partial<LayerBatchWithComputed> = {}): LayerBatchWithComputed {
  return {
    id: 'batch-1',
    farmId: 'farm-1',
    code: 'PON-2026-001',
    strain: 'ISA Brown',
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

function makeForecast(overrides: Partial<LayerForecast> = {}): LayerForecast {
  return {
    batchId: 'batch-1',
    windowDays: 30,
    recordDaysInWindow: 30,
    dataStatus: 'SUFFISANT',
    averageDailyEggs: 900,
    projectedEggsNextWindow: 27_000,
    projectedLayingRatePercent: 90,
    calculatedAt: '2026-09-11T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LayerForecastTable', () => {
  it('affiche le lot avec ses projections quand les données sont suffisantes', () => {
    useLayerBatchesWithForecastMock.mockReturnValue({
      data: [{ batch: makeBatch(), forecast: makeForecast() }],
      isLoading: false,
    });
    render(<LayerForecastTable />);
    expect(screen.getByText('PON-2026-001')).toBeInTheDocument();
    expect(screen.getByText('27 000')).toBeInTheDocument();
    expect(screen.getByText('90.0 %')).toBeInTheDocument();
  });

  it('n’invente jamais de chiffre quand la donnée est insuffisante — affiche « — »', () => {
    useLayerBatchesWithForecastMock.mockReturnValue({
      data: [
        {
          batch: makeBatch(),
          forecast: makeForecast({
            dataStatus: 'INSUFFISANT',
            averageDailyEggs: null,
            projectedEggsNextWindow: null,
            projectedLayingRatePercent: null,
          }),
        },
      ],
      isLoading: false,
    });
    render(<LayerForecastTable />);
    expect(screen.getByText('Insuffisantes')).toBeInTheDocument();
    expect(screen.queryByText('0.0 %')).not.toBeInTheDocument();
  });

  it('affiche un état vide explicite en l’absence de lot en élevage ou en ponte', () => {
    useLayerBatchesWithForecastMock.mockReturnValue({ data: [], isLoading: false });
    render(<LayerForecastTable />);
    expect(screen.getByText('Aucun lot en élevage ou en ponte.')).toBeInTheDocument();
  });
});
