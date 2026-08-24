import { describe, expect, it } from 'vitest';
import type { LayerDailyRecord } from '@dondy-elevage/shared-types';
import { computeSuggestedHenCount } from './hen-count';

function makeRecord(overrides: Partial<LayerDailyRecord> & { date: string }): LayerDailyRecord {
  return {
    id: 'record-id',
    farmId: 'farm-id',
    batchId: 'batch-id',
    operatorId: null,
    henCount: 0,
    mortalityQuantity: 0,
    cullsQuantity: 0,
    otherExitsQuantity: 0,
    eggsLaid: 0,
    eggsBroken: 0,
    eggsRejected: 0,
    eggsSellable: 0,
    layingRatePercent: null,
    feedDistributedKg: null,
    feedItemId: null,
    observations: null,
    createdAt: overrides.date,
    updatedAt: overrides.date,
    ...overrides,
  };
}

describe('computeSuggestedHenCount', () => {
  it('falls back to the initial quantity when no prior day exists', () => {
    expect(computeSuggestedHenCount(undefined, 500, '2026-08-10')).toBe(500);
    expect(computeSuggestedHenCount([], 500, '2026-08-10')).toBe(500);
  });

  it('subtracts mortality, culls and other exits from the most recent prior day', () => {
    const records = [
      makeRecord({ date: '2026-08-09', henCount: 500, mortalityQuantity: 2, cullsQuantity: 1, otherExitsQuantity: 0 }),
    ];
    expect(computeSuggestedHenCount(records, 500, '2026-08-10')).toBe(500 - 2 - 1 - 0);
  });

  it('picks the most recent record strictly before the target date, not the closest overall', () => {
    const records = [
      makeRecord({ date: '2026-08-08', henCount: 500, mortalityQuantity: 0, cullsQuantity: 0, otherExitsQuantity: 0 }),
      makeRecord({ date: '2026-08-09', henCount: 498, mortalityQuantity: 1, cullsQuantity: 0, otherExitsQuantity: 0 }),
      // Un enregistrement à la date cible elle-même (ex. déjà saisi puis
      // rouvert) ne doit jamais être pris comme "jour précédent".
      makeRecord({ date: '2026-08-10', henCount: 497, mortalityQuantity: 5, cullsQuantity: 0, otherExitsQuantity: 0 }),
    ];
    expect(computeSuggestedHenCount(records, 500, '2026-08-10')).toBe(498 - 1);
  });

  it('never floors at zero (mirrors the backend, which does not clamp either)', () => {
    const records = [
      makeRecord({ date: '2026-08-09', henCount: 3, mortalityQuantity: 5, cullsQuantity: 0, otherExitsQuantity: 0 }),
    ];
    expect(computeSuggestedHenCount(records, 500, '2026-08-10')).toBe(-2);
  });
});
