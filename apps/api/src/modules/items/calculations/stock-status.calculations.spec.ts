import { computeStockAutonomyDays, computeStockStatus } from './stock-status.calculations';

describe('computeStockStatus', () => {
  it('retourne ROUGE quand le stock est nul', () => {
    expect(computeStockStatus(0, 100)).toBe('ROUGE');
  });

  it('retourne ROUGE quand le stock est négatif (ne devrait jamais arriver, garde-fou)', () => {
    expect(computeStockStatus(-5, 100)).toBe('ROUGE');
  });

  it('retourne ORANGE quand le stock est sous le seuil minimum', () => {
    expect(computeStockStatus(50, 100)).toBe('ORANGE');
  });

  it('retourne ORANGE quand le stock est exactement au seuil (égalité incluse)', () => {
    expect(computeStockStatus(100, 100)).toBe('ORANGE');
  });

  it('retourne VERT quand le stock est au-dessus du seuil', () => {
    expect(computeStockStatus(150, 100)).toBe('VERT');
  });

  it('retourne VERT quand aucun seuil n’est défini (rien à comparer)', () => {
    expect(computeStockStatus(10, null)).toBe('VERT');
  });
});

describe('computeStockAutonomyDays', () => {
  it('calcule le nombre de jours restants au rythme de consommation moyen', () => {
    expect(computeStockAutonomyDays(450, 50)).toBe(9);
  });

  it('retourne 0 (jamais une erreur) quand la consommation moyenne est nulle', () => {
    expect(computeStockAutonomyDays(450, 0)).toBe(0);
  });
});
