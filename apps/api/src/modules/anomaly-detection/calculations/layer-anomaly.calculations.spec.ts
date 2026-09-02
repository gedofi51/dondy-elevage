import {
  detectLayerCrossSignalAnomaly,
  type LayerDailyRecordLike,
} from './layer-anomaly.calculations';

function makeRecord(
  daysAgo: number,
  overrides: Partial<LayerDailyRecordLike> = {},
): LayerDailyRecordLike {
  const date = new Date('2026-09-10T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return {
    date,
    henCount: 1000,
    mortalityQuantity: 2,
    feedDistributedKg: 120,
    ...overrides,
  };
}

describe('detectLayerCrossSignalAnomaly', () => {
  it('moins de 6 lignes -> INSUFFISANT', () => {
    const records = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const result = detectLayerCrossSignalAnomaly(records);
    expect(result.dataStatus).toBe('INSUFFISANT');
    expect(result.triggered).toBe(false);
  });

  it('baisse aliment + hausse mortalité simultanées -> déclenché, décomposition complète', () => {
    // daysAgo 1-3 = récent (aliment/mortalité dégradés), 4-6 = référence.
    const records = [
      makeRecord(1, { feedDistributedKg: 90, mortalityQuantity: 20 }),
      makeRecord(2, { feedDistributedKg: 90, mortalityQuantity: 20 }),
      makeRecord(3, { feedDistributedKg: 90, mortalityQuantity: 20 }),
      makeRecord(4, { feedDistributedKg: 120, mortalityQuantity: 2 }),
      makeRecord(5, { feedDistributedKg: 120, mortalityQuantity: 2 }),
      makeRecord(6, { feedDistributedKg: 120, mortalityQuantity: 2 }),
    ];
    const result = detectLayerCrossSignalAnomaly(records);
    expect(result.dataStatus).toBe('SUFFISANT');
    expect(result.feed!.triggered).toBe(true);
    expect(result.feed!.changePercent).toBeCloseTo(-25, 5);
    expect(result.mortality!.triggered).toBe(true);
    expect(result.triggered).toBe(true);
    expect(result.recentDateRange).not.toBeNull();
    expect(result.baselineDateRange).not.toBeNull();
  });

  it('seul l’aliment baisse (mortalité stable) -> non déclenché', () => {
    const records = [
      makeRecord(1, { feedDistributedKg: 90 }),
      makeRecord(2, { feedDistributedKg: 90 }),
      makeRecord(3, { feedDistributedKg: 90 }),
      makeRecord(4, { feedDistributedKg: 120 }),
      makeRecord(5, { feedDistributedKg: 120 }),
      makeRecord(6, { feedDistributedKg: 120 }),
    ];
    const result = detectLayerCrossSignalAnomaly(records);
    expect(result.feed!.triggered).toBe(true);
    expect(result.mortality!.triggered).toBe(false);
    expect(result.triggered).toBe(false);
  });

  it('aliment non mesuré sur une ligne -> signal aliment absent, jamais moyenné sur une valeur manquante', () => {
    const records = [
      makeRecord(1, { feedDistributedKg: null, mortalityQuantity: 20 }),
      makeRecord(2, { feedDistributedKg: 90, mortalityQuantity: 20 }),
      makeRecord(3, { feedDistributedKg: 90, mortalityQuantity: 20 }),
      makeRecord(4, { mortalityQuantity: 2 }),
      makeRecord(5, { mortalityQuantity: 2 }),
      makeRecord(6, { mortalityQuantity: 2 }),
    ];
    const result = detectLayerCrossSignalAnomaly(records);
    expect(result.dataStatus).toBe('SUFFISANT');
    expect(result.feed).toBeNull();
    expect(result.triggered).toBe(false);
  });
});
