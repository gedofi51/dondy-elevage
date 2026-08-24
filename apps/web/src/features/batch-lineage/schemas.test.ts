import { describe, expect, it } from 'vitest';
import { getOrientationVisibleFields } from './schemas';

describe('getOrientationVisibleFields', () => {
  it('shows building and manager for CHAIR', () => {
    expect(getOrientationVisibleFields('CHAIR')).toEqual({
      buildingId: true,
      primaryManagerId: true,
      reason: false,
    });
  });

  it('shows only building for RENOUVELLEMENT', () => {
    expect(getOrientationVisibleFields('RENOUVELLEMENT')).toEqual({
      buildingId: true,
      primaryManagerId: false,
      reason: false,
    });
  });

  it('shows no conditional field for VENTE', () => {
    expect(getOrientationVisibleFields('VENTE')).toEqual({
      buildingId: false,
      primaryManagerId: false,
      reason: false,
    });
  });

  it('shows only reason for REFORME_PERTE', () => {
    expect(getOrientationVisibleFields('REFORME_PERTE')).toEqual({
      buildingId: false,
      primaryManagerId: false,
      reason: true,
    });
  });
});
