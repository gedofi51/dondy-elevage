import { computeReceiptDiscrepancy } from './receipt-discrepancy.calculations';

describe('computeReceiptDiscrepancy', () => {
  it('retourne 0 quand la quantité reçue est conforme à la commande', () => {
    expect(computeReceiptDiscrepancy(500, 500)).toBe(0);
  });

  it('retourne un écart négatif en cas de manquant', () => {
    expect(computeReceiptDiscrepancy(500, 480)).toBe(-20);
  });

  it('retourne un écart positif en cas de surplus', () => {
    expect(computeReceiptDiscrepancy(500, 510)).toBe(10);
  });
});
