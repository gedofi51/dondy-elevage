import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BroilerPerformanceCoefficients } from '@dondy-elevage/shared-types';
import { BroilerPerformanceCoefficientsForm } from './performance-coefficients-form';

const useBroilerPerformanceCoefficientsMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock('../hooks', () => ({
  useBroilerPerformanceCoefficients: () => useBroilerPerformanceCoefficientsMock(),
  useUpdateBroilerPerformanceCoefficients: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BroilerPerformanceCoefficientsForm', () => {
  it('affiche un squelette tant que les coefficients ne sont pas chargés', () => {
    useBroilerPerformanceCoefficientsMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<BroilerPerformanceCoefficientsForm />);
    expect(container.querySelector('form')).not.toBeInTheDocument();
  });

  it('préremplit les poids par défaut (1/3) quand aucun coefficient n’est enregistré', () => {
    useBroilerPerformanceCoefficientsMock.mockReturnValue({ data: {}, isLoading: false });
    render(<BroilerPerformanceCoefficientsForm />);

    expect(screen.getByLabelText('Poids mortalité')).toHaveValue('0.33');
    expect(screen.getByLabelText('Poids IC')).toHaveValue('0.33');
    expect(screen.getByLabelText('Poids GMQ')).toHaveValue('0.33');
    expect(screen.getByLabelText('Cible IC (optionnel)')).toHaveValue('');
  });

  it('préremplit avec les coefficients déjà enregistrés', () => {
    const existing: BroilerPerformanceCoefficients = {
      mortality: { weight: 0.5 },
      ic: { weight: 0.3, target: 1.7 },
      gmq: { weight: 0.2, target: 45 },
    };
    useBroilerPerformanceCoefficientsMock.mockReturnValue({ data: existing, isLoading: false });
    render(<BroilerPerformanceCoefficientsForm />);

    expect(screen.getByLabelText('Poids mortalité')).toHaveValue('0.5');
    expect(screen.getByLabelText('Cible IC (optionnel)')).toHaveValue('1.7');
    expect(screen.getByLabelText('Cible GMQ (g/j, optionnel)')).toHaveValue('45');
  });

  it('soumet l’objet complet des 3 composantes, cible omise quand laissée vide', async () => {
    useBroilerPerformanceCoefficientsMock.mockReturnValue({
      data: { mortality: { weight: 0.4 }, ic: { weight: 0.3, target: 1.7 }, gmq: { weight: 0.3 } },
      isLoading: false,
    });
    render(<BroilerPerformanceCoefficientsForm />);

    fireEvent.change(screen.getByLabelText('Poids mortalité'), { target: { value: '0.6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      mortality: { weight: 0.6 },
      ic: { weight: 0.3, target: 1.7 },
      gmq: { weight: 0.3 },
    });
  });

  it('rejette un poids non numérique (validation Zod, pas de soumission)', async () => {
    useBroilerPerformanceCoefficientsMock.mockReturnValue({ data: {}, isLoading: false });
    render(<BroilerPerformanceCoefficientsForm />);

    fireEvent.change(screen.getByLabelText('Poids mortalité'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(screen.getByText('Doit être un nombre positif ou nul')).toBeInTheDocument(),
    );
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
