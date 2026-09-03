import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IncubationPerformanceCoefficients } from '@dondy-elevage/shared-types';
import { IncubationPerformanceCoefficientsForm } from './performance-coefficients-form';

const useIncubationPerformanceCoefficientsMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock('../hooks', () => ({
  useIncubationPerformanceCoefficients: () => useIncubationPerformanceCoefficientsMock(),
  useUpdateIncubationPerformanceCoefficients: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IncubationPerformanceCoefficientsForm', () => {
  it('préremplit les poids par défaut (1/2) quand aucun coefficient n’est enregistré', () => {
    useIncubationPerformanceCoefficientsMock.mockReturnValue({ data: {}, isLoading: false });
    render(<IncubationPerformanceCoefficientsForm />);

    expect(screen.getByLabelText('Poids taux d’éclosion')).toHaveValue('0.50');
    expect(screen.getByLabelText('Poids taux de fécondité')).toHaveValue('0.50');
  });

  it('préremplit avec les coefficients déjà enregistrés', () => {
    const existing: IncubationPerformanceCoefficients = {
      hatchRate: { weight: 0.9 },
      fertilityRate: { weight: 0.1 },
    };
    useIncubationPerformanceCoefficientsMock.mockReturnValue({ data: existing, isLoading: false });
    render(<IncubationPerformanceCoefficientsForm />);

    expect(screen.getByLabelText('Poids taux d’éclosion')).toHaveValue('0.9');
    expect(screen.getByLabelText('Poids taux de fécondité')).toHaveValue('0.1');
  });

  it('soumet l’objet complet des 2 composantes', async () => {
    useIncubationPerformanceCoefficientsMock.mockReturnValue({
      data: { hatchRate: { weight: 0.5 }, fertilityRate: { weight: 0.5 } },
      isLoading: false,
    });
    render(<IncubationPerformanceCoefficientsForm />);

    fireEvent.change(screen.getByLabelText('Poids taux d’éclosion'), { target: { value: '0.7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      hatchRate: { weight: 0.7 },
      fertilityRate: { weight: 0.5 },
    });
  });
});
