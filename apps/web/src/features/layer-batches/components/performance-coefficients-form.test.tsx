import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LayerPerformanceCoefficients } from '@dondy-elevage/shared-types';
import { LayerPerformanceCoefficientsForm } from './performance-coefficients-form';

const useLayerPerformanceCoefficientsMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock('../hooks', () => ({
  useLayerPerformanceCoefficients: () => useLayerPerformanceCoefficientsMock(),
  useUpdateLayerPerformanceCoefficients: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LayerPerformanceCoefficientsForm', () => {
  it('préremplit les poids par défaut (1/2) quand aucun coefficient n’est enregistré', () => {
    useLayerPerformanceCoefficientsMock.mockReturnValue({ data: {}, isLoading: false });
    render(<LayerPerformanceCoefficientsForm />);

    expect(screen.getByLabelText('Poids mortalité')).toHaveValue('0.50');
    expect(screen.getByLabelText('Poids taux de ponte')).toHaveValue('0.50');
  });

  it('préremplit avec les coefficients déjà enregistrés', () => {
    const existing: LayerPerformanceCoefficients = {
      mortality: { weight: 0.7 },
      layingRate: { weight: 0.3 },
    };
    useLayerPerformanceCoefficientsMock.mockReturnValue({ data: existing, isLoading: false });
    render(<LayerPerformanceCoefficientsForm />);

    expect(screen.getByLabelText('Poids mortalité')).toHaveValue('0.7');
    expect(screen.getByLabelText('Poids taux de ponte')).toHaveValue('0.3');
  });

  it('soumet l’objet complet des 2 composantes', async () => {
    useLayerPerformanceCoefficientsMock.mockReturnValue({
      data: { mortality: { weight: 0.5 }, layingRate: { weight: 0.5 } },
      isLoading: false,
    });
    render(<LayerPerformanceCoefficientsForm />);

    fireEvent.change(screen.getByLabelText('Poids taux de ponte'), { target: { value: '0.8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      mortality: { weight: 0.5 },
      layingRate: { weight: 0.8 },
    });
  });
});
