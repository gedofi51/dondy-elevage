import { describe, expect, it } from 'vitest';
import type { BatchLineage } from '@dondy-elevage/shared-types';
import { computeAvailableChicks } from './available-chicks';

function lineageRow(overrides: Partial<BatchLineage>): BatchLineage {
  return {
    id: 'lineage-1',
    farmId: 'farm-1',
    incubationBatchId: 'incubation-1',
    transformationType: 'CHAIR',
    quantity: 0,
    childType: 'broiler_batch',
    childId: 'broiler-1',
    reason: null,
    date: '2026-01-01',
    createdAt: '2026-01-01',
    createdBy: 'user-1',
    ...overrides,
  };
}

describe('computeAvailableChicks', () => {
  it('returns 0 when the hatching bilan has not been entered yet', () => {
    expect(computeAvailableChicks(null, [])).toBe(0);
  });

  it('returns the full hatched count when nothing has been oriented yet', () => {
    expect(computeAvailableChicks(850, undefined)).toBe(850);
    expect(computeAvailableChicks(850, [])).toBe(850);
  });

  it('subtracts the sum of all lineage rows regardless of destination', () => {
    const rows = [
      lineageRow({ transformationType: 'CHAIR', quantity: 500 }),
      lineageRow({ transformationType: 'RENOUVELLEMENT', quantity: 300 }),
      lineageRow({ transformationType: 'REFORME_PERTE', quantity: 15, childType: null, childId: null }),
    ];
    expect(computeAvailableChicks(850, rows)).toBe(35);
  });

  it('can reach exactly zero when fully oriented', () => {
    const rows = [lineageRow({ quantity: 850 })];
    expect(computeAvailableChicks(850, rows)).toBe(0);
  });
});
