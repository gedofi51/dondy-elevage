import { describe, expect, it } from 'vitest';
import { computeLineAmountFcfa, computeOrderTotalFcfa } from './line-totals';

describe('computeLineAmountFcfa', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeLineAmountFcfa(500, 400)).toBe(200_000);
  });

  it('rounds to the nearest integer, like the server', () => {
    expect(computeLineAmountFcfa(1.5, 333)).toBe(Math.round(1.5 * 333));
  });
});

describe('computeOrderTotalFcfa', () => {
  it('sums the line amounts across the whole order', () => {
    const lines = [
      { orderedQuantity: 500, unitPriceFcfa: 400 },
      { orderedQuantity: 10, unitPriceFcfa: 1000 },
    ];
    expect(computeOrderTotalFcfa(lines)).toBe(200_000 + 10_000);
  });

  it('returns 0 for an empty order', () => {
    expect(computeOrderTotalFcfa([])).toBe(0);
  });
});
