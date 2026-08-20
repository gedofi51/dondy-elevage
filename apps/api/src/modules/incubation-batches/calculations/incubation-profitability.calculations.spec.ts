import { computeCostPerChickHatchedFcfa } from './incubation-profitability.calculations';

describe('computeCostPerChickHatchedFcfa', () => {
  it('divides total expenses by chicks hatched', () => {
    expect(computeCostPerChickHatchedFcfa(105000, 850)).toBeCloseTo(123.53, 2);
  });

  it('returns 0 when no chicks hatched (avoids division by zero)', () => {
    expect(computeCostPerChickHatchedFcfa(50000, 0)).toBe(0);
  });

  it('returns 0 when no expenses recorded', () => {
    expect(computeCostPerChickHatchedFcfa(0, 850)).toBe(0);
  });
});
