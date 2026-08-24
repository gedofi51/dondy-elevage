import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SupplierPaymentForm } from './supplier-payment-form';

vi.mock('../hooks', () => ({
  useCreateSupplierPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('SupplierPaymentForm', () => {
  it('displays the remaining balance', () => {
    render(<SupplierPaymentForm purchaseOrderId="po-1" balanceFcfa={50_000} />);

    expect(screen.getByText('Solde restant : 50 000 FCFA.')).toBeInTheDocument();
  });

  it('warns when the entered amount exceeds the remaining balance', () => {
    render(<SupplierPaymentForm purchaseOrderId="po-1" balanceFcfa={50_000} />);

    const amountInput = screen.getByLabelText('Montant (FCFA)');
    fireEvent.change(amountInput, { target: { value: '60000' } });

    expect(
      screen.getByText((content) => content.startsWith('Montant supérieur au solde restant')),
    ).toBeInTheDocument();
  });

  it('does not warn when the entered amount is within the remaining balance', () => {
    render(<SupplierPaymentForm purchaseOrderId="po-1" balanceFcfa={50_000} />);

    const amountInput = screen.getByLabelText('Montant (FCFA)');
    fireEvent.change(amountInput, { target: { value: '30000' } });

    expect(screen.queryByText(/Montant supérieur au solde restant/)).not.toBeInTheDocument();
  });
});
