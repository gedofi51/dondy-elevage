import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Item, ItemForecast } from '@dondy-elevage/shared-types';
import { StockForecastWidget } from './stock-forecast-widget';

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

describe('StockForecastWidget', () => {
  it('affiche un état rassurant quand aucun article n’a de prévision calculable', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [{ item: makeItem(), forecast: makeForecast({ dataStatus: 'INSUFFISANT', autonomyDays: null }) }],
      isLoading: false,
    });
    render(<StockForecastWidget />);
    expect(screen.getByText(/Pas encore assez d.historique/)).toBeInTheDocument();
  });

  it('trie par autonomie croissante et plafonne à 5 articles', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      item: makeItem({ id: `item-${i}`, name: `Article ${i}` }),
      forecast: makeForecast({ itemId: `item-${i}`, autonomyDays: 100 - i }), // décroissant : item-6 = 94j (le plus urgent)
    }));
    useItemsWithForecastMock.mockReturnValue({ data: rows, isLoading: false });
    render(<StockForecastWidget />);

    // Le plus urgent (autonomie la plus faible = item-6, 94j) doit apparaître.
    expect(screen.getByText('Article 6')).toBeInTheDocument();
    // Le moins urgent (item-0, 100j) ne doit pas figurer parmi les 5 affichés.
    expect(screen.queryByText('Article 0')).not.toBeInTheDocument();
  });

  it('ignore les articles à données insuffisantes (jamais un chiffre inventé)', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [
        { item: makeItem({ id: 'ok', name: 'Article OK' }), forecast: makeForecast({ itemId: 'ok', autonomyDays: 10 }) },
        {
          item: makeItem({ id: 'manque', name: 'Article manque' }),
          forecast: makeForecast({ itemId: 'manque', dataStatus: 'INSUFFISANT', autonomyDays: null, estimatedStockoutDate: null }),
        },
      ],
      isLoading: false,
    });
    render(<StockForecastWidget />);
    expect(screen.getByText('Article OK')).toBeInTheDocument();
    expect(screen.queryByText('Article manque')).not.toBeInTheDocument();
  });

  it('ne rend rien pendant le chargement', () => {
    useItemsWithForecastMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<StockForecastWidget />);
    expect(container).toBeEmptyDOMElement();
  });
});
