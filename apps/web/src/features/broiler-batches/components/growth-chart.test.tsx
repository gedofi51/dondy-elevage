import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrowthChart } from './growth-chart';

describe('GrowthChart', () => {
  it('affiche un état explicite quand aucune pesée n’existe (jamais un tracé inventé)', () => {
    render(<GrowthChart points={[]} />);
    expect(screen.getByText('Pas encore de pesée enregistrée pour cette bande.')).toBeInTheDocument();
  });

  it('trace la courbe à partir des pesées réelles, triées par jour', () => {
    render(
      <GrowthChart
        points={[
          { dayNumber: 30, averageWeightG: 1850 },
          { dayNumber: 1, averageWeightG: 45 },
          { dayNumber: 15, averageWeightG: 620 },
        ]}
      />,
    );
    const svg = screen.getByRole('img', { name: /Courbe de croissance/ });
    expect(svg).toBeInTheDocument();
    expect(svg.querySelector('path[fill="none"]')).toHaveAttribute('d', expect.stringMatching(/^M/));
    expect(screen.getByText('J1')).toBeInTheDocument();
    expect(screen.getByText('J30')).toBeInTheDocument();
  });

  it('une seule pesée : trace un point unique sans échouer', () => {
    render(<GrowthChart points={[{ dayNumber: 5, averageWeightG: 180 }]} />);
    expect(screen.getByRole('img', { name: /Courbe de croissance/ })).toBeInTheDocument();
  });
});
