import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bird } from 'lucide-react';
import { KpiCard } from './kpi-card';

describe('KpiCard', () => {
  it('affiche le libellé, la valeur et l’unité', () => {
    render(<KpiCard label="Cheptel actuel" value={12_480} unit="sujets" />);
    expect(screen.getByText('Cheptel actuel')).toBeInTheDocument();
    expect(screen.getByText('12480')).toBeInTheDocument();
    expect(screen.getByText('sujets')).toBeInTheDocument();
  });

  it('applique le ton sémantique demandé', () => {
    render(<KpiCard label="Mortalité du jour" value={23} tone="destructive" icon={Bird} />);
    expect(screen.getByText('23')).toHaveClass('text-destructive');
  });

  it('variante hero (Lot Tableau de bord) : fond primary plein, ignore `tone`', () => {
    render(<KpiCard label="Cheptel actuel" value={12_480} tone="destructive" hero />);
    const value = screen.getByText('12480');
    expect(value).not.toHaveClass('text-destructive');
    const card = value.closest('[data-slot="card"]');
    expect(card).toHaveClass('bg-primary');
  });

  it('affiche une légende secondaire avec son propre ton (Lot Tableau de bord)', () => {
    render(
      <KpiCard label="Aliment disponible" value="4,2 t" caption="2 j d’autonomie" captionTone="warning" />,
    );
    expect(screen.getByText('2 j d’autonomie')).toHaveClass('text-warning');
  });
});
