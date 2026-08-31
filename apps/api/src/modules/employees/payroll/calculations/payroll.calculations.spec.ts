import { BadRequestException } from '@nestjs/common';
import {
  assertNetPayNotNegative,
  computeNetPayFcfa,
  sumOutstandingAdvancesFcfa,
} from './payroll.calculations';

describe('computeNetPayFcfa', () => {
  it('additionne base et primes, soustrait retenues et avances', () => {
    expect(computeNetPayFcfa(100_000, 10_000, 5_000, 15_000)).toBe(90_000);
  });

  it('gère un salaire sans prime/retenue/avance', () => {
    expect(computeNetPayFcfa(80_000, 0, 0, 0)).toBe(80_000);
  });

  it('peut produire un résultat négatif (validé séparément)', () => {
    expect(computeNetPayFcfa(50_000, 0, 40_000, 30_000)).toBe(-20_000);
  });
});

describe('sumOutstandingAdvancesFcfa', () => {
  it('retourne 0 pour une liste vide (aucune avance en attente)', () => {
    expect(sumOutstandingAdvancesFcfa([])).toBe(0);
  });

  it('additionne toutes les avances fournies', () => {
    expect(sumOutstandingAdvancesFcfa([{ amountFcfa: 10_000 }, { amountFcfa: 5_000 }])).toBe(
      15_000,
    );
  });
});

describe('assertNetPayNotNegative', () => {
  it('ne lève rien pour un net positif ou nul', () => {
    expect(() => assertNetPayNotNegative(0)).not.toThrow();
    expect(() => assertNetPayNotNegative(1)).not.toThrow();
  });

  it('lève BadRequestException pour un net négatif', () => {
    expect(() => assertNetPayNotNegative(-1)).toThrow(BadRequestException);
  });
});
