import { describe, expect, it } from 'vitest';
import { getStockMovementTypeForReason } from './reason-type';

describe('getStockMovementTypeForReason', () => {
  it('maps entry-only manual reasons to ENTREE', () => {
    expect(getStockMovementTypeForReason('RETOUR')).toBe('ENTREE');
    expect(getStockMovementTypeForReason('PRODUCTION_INTERNE')).toBe('ENTREE');
  });

  it('maps exit-only manual reasons to SORTIE', () => {
    expect(getStockMovementTypeForReason('VENTE')).toBe('SORTIE');
    expect(getStockMovementTypeForReason('PERTE')).toBe('SORTIE');
    expect(getStockMovementTypeForReason('CASSE')).toBe('SORTIE');
    expect(getStockMovementTypeForReason('CONSOMMATION_INTERNE')).toBe('SORTIE');
  });

  it('requires an explicit choice for AJUSTEMENT (can be either direction)', () => {
    expect(getStockMovementTypeForReason('AJUSTEMENT')).toBe('CHOICE');
  });
});
