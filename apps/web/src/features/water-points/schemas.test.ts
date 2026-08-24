import { describe, expect, it } from 'vitest';
import { createWaterReadingSchema } from './schemas';

function baseReading(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    date: '2026-08-24',
    indexMatin: 100,
    indexSoir: 110,
    cashAmountFcfa: 5000,
    ...overrides,
  };
}

// Miroir des 3 contrôles du §7.3 déjà appliqués côté serveur — seul le
// premier (indexSoir < indexMatin) a un équivalent client (superRefine),
// les deux autres (index matin incohérent, écart de caisse non justifié)
// restent exclusivement serveur (voir schemas.ts, commentaire). Ce fichier
// ne teste donc que ce qui existe réellement côté client.
describe('createWaterReadingSchema', () => {
  it('accepts a normal reading where the evening index is not lower than the morning one', () => {
    const result = createWaterReadingSchema.safeParse(baseReading());
    expect(result.success).toBe(true);
  });

  it('rejects a lower evening index without a consumption override', () => {
    const result = createWaterReadingSchema.safeParse(
      baseReading({ indexSoir: 90, indexAnomalyReason: 'Compteur remis à zéro' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('consumptionM3');
    }
  });

  it('rejects a lower evening index without a justification', () => {
    const result = createWaterReadingSchema.safeParse(
      baseReading({ indexSoir: 90, consumptionM3: 12 }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('indexAnomalyReason');
    }
  });

  it('accepts a lower evening index once both consumption and a reason are provided', () => {
    const result = createWaterReadingSchema.safeParse(
      baseReading({ indexSoir: 90, consumptionM3: 12, indexAnomalyReason: 'Compteur remis à zéro' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a negative index', () => {
    const result = createWaterReadingSchema.safeParse(baseReading({ indexMatin: -1 }));
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer cash amount', () => {
    const result = createWaterReadingSchema.safeParse(baseReading({ cashAmountFcfa: 5000.5 }));
    expect(result.success).toBe(false);
  });
});
