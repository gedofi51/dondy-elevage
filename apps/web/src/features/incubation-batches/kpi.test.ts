import { describe, expect, it } from 'vitest';
import {
  computeEmbryonicMortalityRatePercent,
  computeFertileEggs,
  computeFertilityRatePercent,
  computeHatchRatePercent,
  computeInfectedRatePercent,
} from './kpi';

describe('computeFertileEggs', () => {
  it('subtracts infertile eggs from incubated eggs', () => {
    expect(computeFertileEggs(1050, 130)).toBe(920);
  });
});

describe('computeHatchRatePercent', () => {
  it('computes the ratio of hatched chicks over incubated eggs', () => {
    expect(computeHatchRatePercent(850, 1000)).toBeCloseTo(85);
  });

  it('returns 0 rather than dividing by zero when no eggs were incubated', () => {
    expect(computeHatchRatePercent(0, 0)).toBe(0);
  });
});

describe('computeFertilityRatePercent', () => {
  it('computes the ratio of fertile eggs over incubated eggs', () => {
    expect(computeFertilityRatePercent(920, 1050)).toBeCloseTo((920 / 1050) * 100);
  });

  it('returns 0 when no eggs were incubated', () => {
    expect(computeFertilityRatePercent(0, 0)).toBe(0);
  });
});

describe('computeEmbryonicMortalityRatePercent', () => {
  it('computes the ratio of embryonic mortality over fertile eggs', () => {
    expect(computeEmbryonicMortalityRatePercent(50, 920)).toBeCloseTo((50 / 920) * 100);
  });

  it('returns 0 rather than dividing by zero when there are no fertile eggs', () => {
    expect(computeEmbryonicMortalityRatePercent(0, 0)).toBe(0);
  });
});

describe('computeInfectedRatePercent', () => {
  it('computes the ratio of infected eggs over incubated eggs', () => {
    expect(computeInfectedRatePercent(20, 1000)).toBeCloseTo(2);
  });

  it('returns 0 when no eggs were incubated', () => {
    expect(computeInfectedRatePercent(0, 0)).toBe(0);
  });
});
