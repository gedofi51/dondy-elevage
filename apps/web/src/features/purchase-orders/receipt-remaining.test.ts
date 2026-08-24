import { describe, expect, it } from 'vitest';
import { computeRemainingToReceive } from './receipt-remaining';

describe('computeRemainingToReceive', () => {
  it('returns the difference when some quantity is still outstanding', () => {
    expect(computeRemainingToReceive(500, 300)).toBe(200);
  });

  it('returns 0 when everything has already been received', () => {
    expect(computeRemainingToReceive(500, 500)).toBe(0);
  });

  it('never returns a negative value on a surplus receipt', () => {
    expect(computeRemainingToReceive(500, 550)).toBe(0);
  });
});
