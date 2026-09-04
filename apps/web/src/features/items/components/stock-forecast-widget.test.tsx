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
    status: 'ORANGE',
    ...overrides,
  };
}

function makeForecast(overrides: Partial<ItemForecast> = {}): ItemForecast {
  return {
    itemId: 'item-1',
    status: 'ORANGE',
    dataStatus: 'SUFFISANT',
    windowDays: 30,
    movementDaysInWindow: 10,
    averageDailyConsumption: 5,
    autonomyDays: 9,
    estimatedStockoutDate: '2026-09-13',
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
  it('affiche un état rassurant quand aucun article n’est en alerte de stock', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [{ item: makeItem({ status: 'VERT' }), forecast: makeForecast({ autonomyDays: 60 }) }],
      isLoading: false,
    });
    render(<StockForecastWidget />);
    expect(screen.getByText('Aucun article en alerte de stock actuellement.')).toBeInTheDocument();
  });

  it('trie par autonomie croissante et plafonne à 5 articles, tous en alerte réelle', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      item: makeItem({ id: `item-${i}`, name: `Article ${i}`, status: 'ORANGE' }),
      forecast: makeForecast({ itemId: `item-${i}`, autonomyDays: 100 - i, status: 'ORANGE' }), // décroissant : item-6 = 94j (le plus urgent)
    }));
    useItemsWithForecastMock.mockReturnValue({ data: rows, isLoading: false });
    render(<StockForecastWidget />);

    // Le plus urgent (autonomie la plus faible = item-6, 94j) doit apparaître.
    expect(screen.getByText('Article 6')).toBeInTheDocument();
    // Le moins urgent (item-0, 100j) ne doit pas figurer parmi les 5 affichés.
    expect(screen.queryByText('Article 0')).not.toBeInTheDocument();
  });

  it('ignore les articles au statut VERT (pas réellement "critiques" au sens du seuil serveur)', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [
        {
          item: makeItem({ id: 'critique', name: 'Article critique', status: 'ROUGE' }),
          forecast: makeForecast({ itemId: 'critique', autonomyDays: 2, status: 'ROUGE' }),
        },
        {
          item: makeItem({ id: 'ok', name: 'Article normal', status: 'VERT' }),
          forecast: makeForecast({ itemId: 'ok', autonomyDays: 45, status: 'VERT' }),
        },
      ],
      isLoading: false,
    });
    render(<StockForecastWidget />);
    expect(screen.getByText('Article critique')).toBeInTheDocument();
    expect(screen.queryByText('Article normal')).not.toBeInTheDocument();
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

  it('propose un lien réel vers la création d’une commande d’achat', () => {
    useItemsWithForecastMock.mockReturnValue({
      data: [{ item: makeItem(), forecast: makeForecast() }],
      isLoading: false,
    });
    render(<StockForecastWidget />);
    expect(screen.getByRole('link', { name: 'Créer une commande d’achat' })).toHaveAttribute(
      'href',
      '/achats/nouveau',
    );
  });
});
