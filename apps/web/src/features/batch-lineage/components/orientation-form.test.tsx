import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrientationForm } from './orientation-form';

vi.mock('@/features/buildings/hooks', () => ({
  useBuildings: () => ({ data: [{ id: 'building-1', name: 'Poulailler A' }] }),
}));
vi.mock('@/features/users/hooks', () => ({
  useUsers: () => ({ data: [{ id: 'user-1', name: 'Jean Responsable' }] }),
}));
vi.mock('../hooks', () => ({
  useCreateOrientation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('OrientationForm', () => {
  it('shows the building and manager fields by default (CHAIR destination)', () => {
    render(<OrientationForm incubationBatchId="incubation-1" available={850} />);

    expect(screen.getByText('Bâtiment')).toBeInTheDocument();
    expect(screen.getByText('Responsable')).toBeInTheDocument();
    expect(screen.queryByText('Motif')).not.toBeInTheDocument();
  });

  it('displays the available balance', () => {
    render(<OrientationForm incubationBatchId="incubation-1" available={35} />);

    expect(screen.getByText('35 poussins disponibles à orienter.')).toBeInTheDocument();
  });

  it('warns when the entered quantity exceeds the available balance', () => {
    render(<OrientationForm incubationBatchId="incubation-1" available={10} />);

    const quantityInput = screen.getByLabelText('Quantité');
    fireEvent.change(quantityInput, { target: { value: '25' } });

    expect(
      screen.getByText((content) => content.startsWith('Quantité supérieure au solde disponible')),
    ).toBeInTheDocument();
  });

  it('does not warn when the entered quantity is within the available balance', () => {
    render(<OrientationForm incubationBatchId="incubation-1" available={10} />);

    const quantityInput = screen.getByLabelText('Quantité');
    fireEvent.change(quantityInput, { target: { value: '5' } });

    expect(screen.queryByText(/Quantité supérieure au solde disponible/)).not.toBeInTheDocument();
  });
});
