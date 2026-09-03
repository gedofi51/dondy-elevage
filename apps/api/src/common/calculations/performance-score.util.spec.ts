import {
  computeWeightedScore,
  contributionFromRatePercent,
  contributionFromRatioToTarget,
} from './performance-score.util';

describe('contributionFromRatePercent', () => {
  it('HIGHER_IS_BETTER renvoie le taux tel quel (ponte, éclosion)', () => {
    expect(contributionFromRatePercent(72, 'HIGHER_IS_BETTER')).toBe(72);
  });

  it('LOWER_IS_BETTER renvoie le complément à 100 (mortalité)', () => {
    expect(contributionFromRatePercent(3, 'LOWER_IS_BETTER')).toBe(97);
  });

  it('borne à [0, 100] même sur une valeur aberrante en amont', () => {
    expect(contributionFromRatePercent(150, 'HIGHER_IS_BETTER')).toBe(100);
    expect(contributionFromRatePercent(-5, 'HIGHER_IS_BETTER')).toBe(0);
    expect(contributionFromRatePercent(150, 'LOWER_IS_BETTER')).toBe(0);
  });
});

describe('contributionFromRatioToTarget', () => {
  it('HIGHER_IS_BETTER : atteint la cible = 100', () => {
    expect(contributionFromRatioToTarget(45, 45, 'HIGHER_IS_BETTER')).toBe(100);
  });

  it('HIGHER_IS_BETTER : en dessous de la cible = proportionnel', () => {
    expect(contributionFromRatioToTarget(36, 45, 'HIGHER_IS_BETTER')).toBeCloseTo(80);
  });

  it('HIGHER_IS_BETTER : au-dessus de la cible = plafonné à 100', () => {
    expect(contributionFromRatioToTarget(60, 45, 'HIGHER_IS_BETTER')).toBe(100);
  });

  it('LOWER_IS_BETTER (IC) : atteint la cible = 100', () => {
    expect(contributionFromRatioToTarget(1.7, 1.7, 'LOWER_IS_BETTER')).toBe(100);
  });

  it('LOWER_IS_BETTER (IC) : au-dessus de la cible (pire) = proportionnellement réduit', () => {
    expect(contributionFromRatioToTarget(2.0, 1.7, 'LOWER_IS_BETTER')).toBeCloseTo(85, 0);
  });

  it('cible non configurée (<= 0) : contribution non calculable, jamais 0 inventé', () => {
    expect(contributionFromRatioToTarget(45, 0, 'HIGHER_IS_BETTER')).toBeNull();
    expect(contributionFromRatioToTarget(1.7, -1, 'LOWER_IS_BETTER')).toBeNull();
  });
});

describe('computeWeightedScore', () => {
  it('moyenne pondérée simple quand toutes les composantes sont disponibles', () => {
    const score = computeWeightedScore([
      { key: 'a', weight: 1, contributionPercent: 100 },
      { key: 'b', weight: 1, contributionPercent: 50 },
    ]);
    expect(score).toBe(75);
  });

  it('renormalise sur les poids des composantes utilisables uniquement', () => {
    const score = computeWeightedScore([
      { key: 'a', weight: 1, contributionPercent: 90 },
      { key: 'b', weight: 1, contributionPercent: null }, // exclue, pas moyennée à 0
      { key: 'c', weight: 2, contributionPercent: 60 },
    ]);
    // (90*1 + 60*2) / (1+2) = 70, pas (90+0+60*2)/4
    expect(score).toBeCloseTo(70);
  });

  it('renvoie null si aucune composante utilisable — jamais 0 (pire score inventé)', () => {
    expect(
      computeWeightedScore([
        { key: 'a', weight: 1, contributionPercent: null },
        { key: 'b', weight: 1, contributionPercent: null },
      ]),
    ).toBeNull();
  });

  it('ignore un poids négatif (neutralisé, pas inversé)', () => {
    const score = computeWeightedScore([
      { key: 'a', weight: -1, contributionPercent: 20 },
      { key: 'b', weight: 1, contributionPercent: 80 },
    ]);
    expect(score).toBe(80);
  });

  it('renvoie null si tous les poids configurés sont nuls', () => {
    expect(
      computeWeightedScore([
        { key: 'a', weight: 0, contributionPercent: 90 },
        { key: 'b', weight: 0, contributionPercent: 10 },
      ]),
    ).toBeNull();
  });
});
