import { computeLotAgeDays, resolveAgingSeverity } from './egg-stock-aging.calculations';

describe('computeLotAgeDays', () => {
  it('calcule un âge de 0 jour le jour même', () => {
    const date = new Date('2026-08-19T08:00:00Z');
    expect(computeLotAgeDays(date, new Date('2026-08-19T20:00:00Z'))).toBe(0);
  });

  it('calcule un âge de 7 jours pleins', () => {
    const produced = new Date('2026-08-01T00:00:00Z');
    const today = new Date('2026-08-08T00:00:00Z');
    expect(computeLotAgeDays(produced, today)).toBe(7);
  });
});

describe('resolveAgingSeverity', () => {
  const vigilance = 4;
  const important = 7;

  it('retourne NONE sous le seuil de vigilance', () => {
    expect(resolveAgingSeverity(3, vigilance, important)).toBe('NONE');
  });

  it('retourne VIGILANCE à partir du seuil de vigilance', () => {
    expect(resolveAgingSeverity(4, vigilance, important)).toBe('VIGILANCE');
    expect(resolveAgingSeverity(6, vigilance, important)).toBe('VIGILANCE');
  });

  it('retourne IMPORTANT à partir du seuil important', () => {
    expect(resolveAgingSeverity(7, vigilance, important)).toBe('IMPORTANT');
    expect(resolveAgingSeverity(30, vigilance, important)).toBe('IMPORTANT');
  });
});
