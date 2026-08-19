import {
  computeGrossAmountFcfa,
  computeNetAmountFcfa,
  computeSaleStatus,
} from './broiler-sales.calculations';

describe('computeGrossAmountFcfa', () => {
  it('reproduit le scénario §25 : 300 poulets à 6000 FCFA -> 1 800 000 FCFA', () => {
    expect(computeGrossAmountFcfa(300, 6000)).toBe(1_800_000);
  });
});

describe('computeNetAmountFcfa', () => {
  it('soustrait la remise du montant brut', () => {
    expect(computeNetAmountFcfa(1_800_000, 50_000)).toBe(1_750_000);
  });

  it('ne fait rien de spécial sans remise', () => {
    expect(computeNetAmountFcfa(1_800_000, 0)).toBe(1_800_000);
  });
});

describe('computeSaleStatus', () => {
  it('reste BROUILLON/RESERVEE/ANNULEE quel que soit le montant payé', () => {
    expect(computeSaleStatus(100_000, 100_000, 'BROUILLON')).toBe('BROUILLON');
    expect(computeSaleStatus(100_000, 100_000, 'RESERVEE')).toBe('RESERVEE');
    expect(computeSaleStatus(100_000, 100_000, 'ANNULEE')).toBe('ANNULEE');
  });

  it('passe à IMPAYEE si aucun paiement enregistré', () => {
    expect(computeSaleStatus(100_000, 0, 'CONFIRMEE')).toBe('IMPAYEE');
  });

  it('passe à PARTIELLEMENT_PAYEE si le paiement est partiel', () => {
    expect(computeSaleStatus(100_000, 40_000, 'CONFIRMEE')).toBe('PARTIELLEMENT_PAYEE');
  });

  it('passe à PAYEE si le paiement cumulé atteint le montant net', () => {
    expect(computeSaleStatus(100_000, 100_000, 'CONFIRMEE')).toBe('PAYEE');
  });

  it('reste PAYEE en cas de trop-perçu, sans plafonner silencieusement', () => {
    expect(computeSaleStatus(100_000, 120_000, 'PARTIELLEMENT_PAYEE')).toBe('PAYEE');
  });
});
