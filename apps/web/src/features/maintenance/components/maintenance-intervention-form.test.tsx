import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MaintenanceInterventionForm } from './maintenance-intervention-form';

vi.mock('../hooks', () => ({
  useCreateMaintenanceIntervention: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/items/hooks', () => ({
  useItems: () => ({
    data: [{ id: 'item-1', name: 'Filtre à eau', unit: 'pièce', currentStock: 5, averageUnitCostFcfa: 2000 }],
  }),
}));

describe('MaintenanceInterventionForm', () => {
  it('affiche les champs fixes de l’intervention', () => {
    render(<MaintenanceInterventionForm assetId="asset-1" />);

    expect(screen.getByLabelText('Date d’intervention')).toBeInTheDocument();
    expect(screen.getByLabelText('Intervenant')).toBeInTheDocument();
    expect(screen.getByLabelText('Diagnostic')).toBeInTheDocument();
    expect(screen.getByLabelText('Coût main-d’œuvre (FCFA)')).toBeInTheDocument();
  });

  it('affiche la mise en garde sur le caractère estimatif de l’aperçu', () => {
    render(<MaintenanceInterventionForm assetId="asset-1" />);

    expect(
      screen.getByText(/Estimation basée sur le coût moyen actuel des articles/),
    ).toBeInTheDocument();
  });

  it('ajoute une ligne de pièce au clic sur « Ajouter une pièce »', () => {
    render(<MaintenanceInterventionForm assetId="asset-1" />);

    expect(screen.queryByText('Coût pièces estimé (informatif) : 0 FCFA')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Ajouter une pièce'));

    expect(screen.getByText('Quantité')).toBeInTheDocument();
    expect(screen.getByText('Coût pièces estimé (informatif) : 0 FCFA')).toBeInTheDocument();
  });

  it('retire une ligne de pièce au clic sur le bouton de suppression', () => {
    render(<MaintenanceInterventionForm assetId="asset-1" />);

    fireEvent.click(screen.getByText('Ajouter une pièce'));
    expect(screen.getByText('Quantité')).toBeInTheDocument();

    const removeButton = screen.getAllByRole('button').find((btn) => btn.querySelector('svg.lucide-trash2'));
    fireEvent.click(removeButton!);

    expect(screen.queryByText('Quantité')).not.toBeInTheDocument();
  });

  it('recalcule le coût total estimé quand le coût main-d’œuvre change', () => {
    render(<MaintenanceInterventionForm assetId="asset-1" />);

    const laborInput = screen.getByLabelText('Coût main-d’œuvre (FCFA)');
    fireEvent.change(laborInput, { target: { value: '15000' } });

    expect(
      screen.getByText('Coût total estimé (informatif) : 15 000 FCFA'),
    ).toBeInTheDocument();
  });
});
