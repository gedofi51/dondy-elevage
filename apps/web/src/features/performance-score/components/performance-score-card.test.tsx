import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BatchPerformanceScore } from '@dondy-elevage/shared-types';
import { PerformanceScoreCard } from './performance-score-card';

function makeScore(overrides: Partial<BatchPerformanceScore> = {}): BatchPerformanceScore {
  return {
    scoreOn100: 82,
    dataStatus: 'SUFFISANT',
    calculatedAt: '2026-09-03T08:00:00.000Z',
    components: [
      {
        key: 'mortality',
        label: 'Taux de mortalité cumulé',
        rawValue: 3,
        unit: '%',
        target: null,
        weight: 0.4,
        contributionPercent: 97,
      },
      {
        key: 'ic',
        label: 'Indice de consommation (IC)',
        rawValue: 1.8,
        unit: '',
        target: 1.7,
        weight: 0.3,
        contributionPercent: 94,
      },
      {
        key: 'gmq',
        label: 'GMQ moyen (cycle)',
        rawValue: null,
        unit: 'g/j',
        target: 45,
        weight: 0.3,
        contributionPercent: null,
      },
    ],
    ...overrides,
  };
}

describe('PerformanceScoreCard', () => {
  it('affiche le score total et la décomposition complète (côte à côte, jamais un score seul)', () => {
    render(<PerformanceScoreCard score={makeScore()} />);
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Taux de mortalité cumulé')).toBeInTheDocument();
    expect(screen.getByText('Indice de consommation (IC)')).toBeInTheDocument();
    expect(screen.getByText('GMQ moyen (cycle)')).toBeInTheDocument();
  });

  it('composante sans contribution (donnée insuffisante) affiche "—", jamais un chiffre inventé', () => {
    render(<PerformanceScoreCard score={makeScore()} />);
    const gmqRow = screen.getByText('GMQ moyen (cycle)').closest('tr')!;
    expect(gmqRow.textContent).toContain('—');
  });

  it('dataStatus INSUFFISANT : état explicite rassurant, jamais un score inventé', () => {
    render(
      <PerformanceScoreCard
        score={makeScore({ dataStatus: 'INSUFFISANT', scoreOn100: null })}
      />,
    );
    expect(screen.getByText(/Pas encore assez de données/)).toBeInTheDocument();
    expect(screen.queryByText('82')).not.toBeInTheDocument();
  });

  it('affiche systématiquement la date de calcul', () => {
    render(<PerformanceScoreCard score={makeScore()} />);
    expect(screen.getByText(/Calculé le/)).toBeInTheDocument();
  });
});
