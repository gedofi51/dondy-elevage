import { safeDivide } from './safe-math.util';

describe('safeDivide', () => {
  it('divise normalement quand le dénominateur est non nul', () => {
    expect(safeDivide(10, 4)).toBe(2.5);
  });

  it('retourne 0 (jamais une erreur) quand le dénominateur est zéro', () => {
    expect(safeDivide(10, 0)).toBe(0);
  });

  it('retourne 0 quand le dénominateur est négatif zéro', () => {
    expect(safeDivide(10, -0)).toBe(0);
  });

  it('retourne 0 quand le dénominateur est non fini (NaN/Infinity)', () => {
    expect(safeDivide(10, NaN)).toBe(0);
    expect(safeDivide(10, Infinity)).toBe(0);
  });

  it('retourne 0 quand le numérateur est aussi 0', () => {
    expect(safeDivide(0, 0)).toBe(0);
  });
});
