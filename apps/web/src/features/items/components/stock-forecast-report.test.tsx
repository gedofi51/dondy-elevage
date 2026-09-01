import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Item, ItemForecast } from '@dondy-elevage/shared-types';
import { StockForecastReport } from './stock-forecast-report';

const useItemsWithForecastMock = vi.fn();

vi.mock('../hooks', () => ({
  useItemsWithForecast: () => useItemsWithForecastMock(),
}));

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Aliment démarrage',
    category: 'Aliments',
    unit: 'kg',
    minThreshold: '50',
    currentStock: '300',
    averageUnitCostFcfa: 500,
    supplierId: null,
    status: 'VERT',
    ...overrides,
  };
}

function makeForecast(overrides: Partial<ItemForecast> = {}): ItemForecast {
  return {
    itemId: 'item-1',
    status: 'VERT',
    dataStatus: 'SUFFISANT',
    windowDays: 30,
    movementDaysInWindow: 10,
    averageDailyConsumption: 5,
    autonomyDays: 60,
    estimatedStockoutDate: '2026-11-01',
    suggestedReorderQuantity: null,
    reorderBasis: null,
    calculatedAt: '2026-09-01T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StockForecastReport', () => {
  it('affiche les colonnes prévisionnelles calculées quand la donnée est suffisante', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [{ item: makeItem(), forecast: makeForecast() }],
      isLoading: false,
    });
    render(<StockForecastReport />);
    expect(screen.getByText('Aliment démarrage')).toBeInTheDocument();
    expect(screen.getByText('60 j')).toBeInTheDocument();
    expect(screen.getByText('01/11/2026')).toBeInTheDocument();
  });

  it('n’invente jamais de chiffre quand les données sont insuffisantes — affiche « — »', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [
        {
          item: makeItem({ id: 'item-2', name: 'Article rare' }),
          forecast: makeForecast({
            itemId: 'item-2',
            dataStatus: 'INSUFFISANT',
            averageDailyConsumption: null,
            autonomyDays: null,
            estimatedStockoutDate: null,
            suggestedReorderQuantity: null,
            reorderBasis: null,
          }),
        },
      ],
      isLoading: false,
    });
    render(<StockForecastReport />);
    expect(screen.getByText('Article rare')).toBeInTheDocument();
    expect(screen.getByText('Insuffisantes')).toBeInTheDocument();
    // Autonomie/rupture/réappro : "—" partout, jamais "0 j" ou une date inventée.
    expect(screen.queryByText('0 j')).not.toBeInTheDocument();
  });

  it('affiche la base de la suggestion de réapprovisionnement (seuil minimum vs consommation)', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [
        {
          item: makeItem({ id: 'item-3', name: 'Article seuil' }),
          forecast: makeForecast({
            itemId: 'item-3',
            dataStatus: 'INSUFFISANT',
            averageDailyConsumption: null,
            autonomyDays: null,
            estimatedStockoutDate: null,
            suggestedReorderQuantity: 60,
            reorderBasis: 'SEUIL_MINIMUM',
          }),
        },
      ],
      isLoading: false,
    });
    render(<StockForecastReport />);
    expect(screen.getByText(/seuil min\./)).toBeInTheDocument();
  });

  it('filtre par statut (Rupture) au clic', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [
        { item: makeItem({ id: 'item-vert', name: 'Article vert', status: 'VERT' }), forecast: makeForecast({ itemId: 'item-vert' }) },
        { item: makeItem({ id: 'item-rouge', name: 'Article rouge', status: 'ROUGE' }), forecast: makeForecast({ itemId: 'item-rouge', status: 'ROUGE' }) },
      ],
      isLoading: false,
    });
    render(<StockForecastReport />);
    expect(screen.getByText('Article vert')).toBeInTheDocument();
    expect(screen.getByText('Article rouge')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rupture' }));
    expect(screen.queryByText('Article vert')).not.toBeInTheDocument();
    expect(screen.getByText('Article rouge')).toBeInTheDocument();
  });

  it('filtre "Données insuffisantes" au clic', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [
        { item: makeItem({ id: 'item-ok', name: 'Article OK' }), forecast: makeForecast({ itemId: 'item-ok' }) },
        {
          item: makeItem({ id: 'item-manque', name: 'Article manque de données' }),
          forecast: makeForecast({ itemId: 'item-manque', dataStatus: 'INSUFFISANT', averageDailyConsumption: null, autonomyDays: null, estimatedStockoutDate: null }),
        },
      ],
      isLoading: false,
    });
    render(<StockForecastReport />);
    fireEvent.click(screen.getByRole('button', { name: 'Données insuffisantes' }));
    expect(screen.queryByText('Article OK')).not.toBeInTheDocument();
    expect(screen.getByText('Article manque de données')).toBeInTheDocument();
  });
});
