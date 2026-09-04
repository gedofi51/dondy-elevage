import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { DashboardPrimaryKpis } from './dashboard-kpi-row';

let mockPermissions: string[] = [];
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { permissions: mockPermissions } }),
}));

const useBroilerBatchesMock = vi.fn();
const useTodayMortalityByBatchMock = vi.fn();
vi.mock('@/features/broiler-batches/hooks', () => ({
  useBroilerBatches: (...args: unknown[]) => useBroilerBatchesMock(...args),
  useTodayMortalityByBatch: (...args: unknown[]) => useTodayMortalityByBatchMock(...args),
}));

const useLayerBatchesMock = vi.fn();
const useTodayEggProductionTotalMock = vi.fn();
vi.mock('@/features/layer-batches/hooks', () => ({
  useLayerBatches: (...args: unknown[]) => useLayerBatchesMock(...args),
  useTodayEggProductionTotal: (...args: unknown[]) => useTodayEggProductionTotalMock(...args),
}));

const useItemsWithForecastMock = vi.fn();
vi.mock('@/features/items/hooks', () => ({
  useItemsWithForecast: () => useItemsWithForecastMock(),
}));

function makeBroilerBatch(overrides: Record<string, unknown> = {}) {
  return { id: 'b1', code: 'PC-2026-001', status: 'EN_CROISSANCE', currentHeadcount: 2850, ...overrides };
}
function makeLayerBatch(overrides: Record<string, unknown> = {}) {
  return { id: 'l1', code: 'PON-2026-001', status: 'PONTE', currentHeadcount: 2400, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions = [
    PERMISSIONS.BROILER_BATCHES_READ,
    PERMISSIONS.LAYER_BATCHES_READ,
    PERMISSIONS.BROILER_DAILY_RECORDS_READ,
    PERMISSIONS.LAYER_DAILY_RECORDS_READ,
    PERMISSIONS.ITEMS_READ,
  ];
  useBroilerBatchesMock.mockReturnValue({ data: [makeBroilerBatch()] });
  useLayerBatchesMock.mockReturnValue({ data: [makeLayerBatch()] });
  useTodayMortalityByBatchMock.mockReturnValue([{ batch: makeBroilerBatch(), mortality: 0 }]);
  useTodayEggProductionTotalMock.mockReturnValue(2190);
  useItemsWithForecastMock.mockReturnValue({ data: [] });
});

describe('DashboardPrimaryKpis', () => {
  it('affiche le cheptel combiné (chair + ponte) sur la carte vedette', () => {
    render(<DashboardPrimaryKpis />);
    expect(screen.getByText('Cheptel actuel')).toBeInTheDocument();
    expect(screen.getByText(/^5.250$/)).toBeInTheDocument(); // 2850 + 2400
  });

  it('affiche la répartition chair/ponte des bandes actives', () => {
    render(<DashboardPrimaryKpis />);
    expect(screen.getByText('1 chair · 1 ponte')).toBeInTheDocument();
  });

  it('met en évidence la bande la plus touchée par la mortalité du jour', () => {
    useTodayMortalityByBatchMock.mockReturnValue([
      { batch: makeBroilerBatch({ code: 'A-15' }), mortality: 12 },
      { batch: makeBroilerBatch({ id: 'b2', code: 'A-14' }), mortality: 3 },
    ]);
    render(<DashboardPrimaryKpis />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('▲ concentrée sur A-15')).toBeInTheDocument();
  });

  it('aucune sur-mortalité : pas de légende affichée (jamais une bande désignée arbitrairement)', () => {
    render(<DashboardPrimaryKpis />);
    expect(screen.queryByText(/concentrée sur/)).not.toBeInTheDocument();
  });

  it('calcule le taux de ponte réel à partir des données déjà chargées', () => {
    render(<DashboardPrimaryKpis />);
    // 2190 / 2400 * 100 = 91.25 -> 91,3 %
    expect(screen.getByText('91,3 % de ponte')).toBeInTheDocument();
  });

  it('un rôle sans LAYER_BATCHES_READ ne voit aucune carte dépendant des pondeuses', () => {
    mockPermissions = [PERMISSIONS.BROILER_BATCHES_READ, PERMISSIONS.BROILER_DAILY_RECORDS_READ];
    render(<DashboardPrimaryKpis />);
    expect(screen.queryByText('Production d’œufs')).not.toBeInTheDocument();
  });

  it('un rôle sans aucune permission de lecture bande ne voit ni Cheptel ni Bandes actives', () => {
    mockPermissions = [];
    render(<DashboardPrimaryKpis />);
    expect(screen.queryByText('Cheptel actuel')).not.toBeInTheDocument();
    expect(screen.queryByText('Bandes actives')).not.toBeInTheDocument();
  });

  it('aliment disponible : agrège le stock réel et signale l’article le plus urgent', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [
        {
          item: { id: 'i1', name: 'Aliment démarrage', category: 'Aliments', unit: 'kg', currentStock: '320' },
          forecast: { dataStatus: 'SUFFISANT', autonomyDays: 2 },
        },
        {
          item: { id: 'i2', name: 'Aliment croissance', category: 'Aliments', unit: 'kg', currentStock: '3900' },
          forecast: { dataStatus: 'SUFFISANT', autonomyDays: 9 },
        },
      ],
    });
    render(<DashboardPrimaryKpis />);
    expect(screen.getByText('4,2 t')).toBeInTheDocument();
    expect(screen.getByText('2 j d’autonomie')).toBeInTheDocument();
  });
});
