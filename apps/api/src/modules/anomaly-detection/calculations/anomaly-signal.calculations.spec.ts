import { computeDeclineSignal, computeIncreaseSignal } from './anomaly-signal.calculations';

describe('computeDeclineSignal', () => {
  it('déclenché quand la baisse atteint le seuil', () => {
    // Moyenne récente 42.5 vs référence 58 -> -26.7 %, seuil -15 %.
    const signal = computeDeclineSignal('Eau', 'L/j', [40, 45], [58, 58], 15);
    expect(signal.recentAverage).toBe(42.5);
    expect(signal.baselineAverage).toBe(58);
    expect(signal.changePercent).toBeCloseTo(-26.72, 1);
    expect(signal.triggered).toBe(true);
  });

  it('non déclenché quand la baisse n’atteint pas le seuil', () => {
    const signal = computeDeclineSignal('Eau', 'L/j', [55, 56], [58, 58], 15);
    expect(signal.triggered).toBe(false);
  });

  it('non déclenché sur une hausse (changePercent positif)', () => {
    const signal = computeDeclineSignal('Eau', 'L/j', [70, 72], [58, 58], 15);
    expect(signal.changePercent).toBeGreaterThan(0);
    expect(signal.triggered).toBe(false);
  });

  it('moyenne de référence nulle -> jamais déclenché, jamais un chiffre inventé', () => {
    const signal = computeDeclineSignal('Eau', 'L/j', [0, 0], [0, 0], 15);
    expect(signal.changePercent).toBe(0);
    expect(signal.triggered).toBe(false);
  });
});

describe('computeIncreaseSignal', () => {
  it('déclenché quand la hausse atteint le seuil', () => {
    // Moyenne récente 0.6 vs référence 0.2 -> +200 %, seuil 50 %.
    const signal = computeIncreaseSignal('Mortalité', '%/j', [0.6, 0.6], [0.2, 0.2], 50);
    expect(signal.changePercent).toBeCloseTo(200, 5);
    expect(signal.triggered).toBe(true);
  });

  it('non déclenché quand la hausse n’atteint pas le seuil', () => {
    const signal = computeIncreaseSignal('Mortalité', '%/j', [0.25, 0.25], [0.2, 0.2], 50);
    expect(signal.triggered).toBe(false);
  });

  it('référence nulle + valeur récente positive -> toujours déclenché (apparition)', () => {
    const signal = computeIncreaseSignal('Mortalité', '%/j', [0.3, 0.3], [0, 0], 50);
    expect(signal.baselineAverage).toBe(0);
    expect(signal.changePercent).toBe(Infinity);
    expect(signal.triggered).toBe(true);
  });

  it('référence nulle et valeur récente nulle -> jamais déclenché', () => {
    const signal = computeIncreaseSignal('Mortalité', '%/j', [0, 0], [0, 0], 50);
    expect(signal.changePercent).toBe(0);
    expect(signal.triggered).toBe(false);
  });
});
