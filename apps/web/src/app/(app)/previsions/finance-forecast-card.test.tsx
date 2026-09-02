import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TreasuryForecast } from '@dondy-elevage/shared-types';
import { FinanceForecastCard } from './finance-forecast-card';

const useTreasuryForecastMock = vi.fn();

vi.mock('@/features/treasury/hooks', () => ({
  useTreasuryForecast: () => useTreasuryForecastMock(),
}));

function makeForecast(overrides: Partial<TreasuryForecast> = {}): TreasuryForecast {
  return {
    periodStart: '2026-09-01T00:00:00.000Z',
    periodEnd: '2026-09-30T00:00:00.000Z',
    daysElapsed: 10,
    daysTotal: 30,
    dataStatus: 'SUFFISANT',
    realized: { revenueFcfa: 500_000, totalExpensesFcfa: 300_000, netTreasuryFcfa: 200_000 },
    projected: {
      revenueFcfa: 1_500_000,
      totalExpensesFcfa: 900_000,
      grossMarginFcfa: 600_000,
      profitabilityRate: 66.7,
      netTreasuryFcfa: 600_000,
    },
    calculatedAt: '2026-09-11T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FinanceForecastCard', () => {
  it('affiche le réalisé à date et le projeté fin de mois, distinctement', () => {
    useTreasuryForecastMock.mockReturnValue({ data: makeForecast(), isLoading: false });
    render(<FinanceForecastCard />);
    expect(screen.getByText('Réalisé depuis le 1er du mois')).toBeInTheDocument();
    expect(screen.getByText('500 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText(/Projeté fin de mois/)).toBeInTheDocument();
    expect(screen.getByText('1 500 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('66.7 %')).toBeInTheDocument();
  });

  it('besoin de trésorerie négatif affiché tel quel — jamais masqué', () => {
    useTreasuryForecastMock.mockReturnValue({
      data: makeForecast({
        projected: {
          revenueFcfa: 300_000,
          totalExpensesFcfa: 1_200_000,
          grossMarginFcfa: -900_000,
          profitabilityRate: -75,
          netTreasuryFcfa: -650_000,
        },
      }),
      isLoading: false,
    });
    render(<FinanceForecastCard />);
    expect(screen.getByText('-900 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('-650 000 FCFA')).toBeInTheDocument();
  });

  it('donnée insuffisante -> message explicite, aucun chiffre projeté inventé', () => {
    useTreasuryForecastMock.mockReturnValue({
      data: makeForecast({ dataStatus: 'INSUFFISANT', projected: null }),
      isLoading: false,
    });
    render(<FinanceForecastCard />);
    expect(
      screen.getByText(/Pas encore assez de jours écoulés ce mois-ci/),
    ).toBeInTheDocument();
  });

  it('ne rend rien pendant le chargement', () => {
    useTreasuryForecastMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<FinanceForecastCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
