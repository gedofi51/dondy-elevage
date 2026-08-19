import { computeDayNumber, resolveCalendarMilestone } from './broiler-calendar';

describe('computeDayNumber', () => {
  it('retourne 1 le jour même de l’arrivée (J1)', () => {
    expect(computeDayNumber(new Date('2026-09-01'), new Date('2026-09-01'))).toBe(1);
  });

  it('retourne 45 pour arrivalDate + 44 jours', () => {
    expect(computeDayNumber(new Date('2026-09-01'), new Date('2026-10-15'))).toBe(45);
  });

  it('ignore l’heure de la journée (seule la date calendaire compte)', () => {
    expect(computeDayNumber(new Date('2026-09-01T22:00:00'), new Date('2026-09-02T02:00:00'))).toBe(
      2,
    );
  });

  it('gère J46+ (dépassement)', () => {
    expect(computeDayNumber(new Date('2026-09-01'), new Date('2026-10-20'))).toBeGreaterThanOrEqual(
      46,
    );
  });
});

describe('resolveCalendarMilestone', () => {
  it.each([
    [1, 'INFO'],
    [7, 'INFO'],
    [14, 'INFO'],
    [15, 'INFO'],
    [21, 'INFO'],
    [30, 'INFO'],
    [31, 'INFO'],
    [35, 'INFO'],
    [40, 'IMPORTANT'],
    [42, 'IMPORTANT'],
    [44, 'IMPORTANT'],
    [45, 'IMPORTANT'],
  ] as const)('résout le jalon J%i avec la sévérité %s', (day, severity) => {
    const milestone = resolveCalendarMilestone(day);
    expect(milestone).not.toBeNull();
    expect(milestone?.severity).toBe(severity);
    expect(milestone?.type).toBe(`batch_calendar_j${day}`);
  });

  it('résout tout jour >= 46 vers le même jalon CRITIQUE idempotent (pas un par jour)', () => {
    expect(resolveCalendarMilestone(46)).toEqual(resolveCalendarMilestone(60));
    expect(resolveCalendarMilestone(46)?.severity).toBe('CRITIQUE');
    expect(resolveCalendarMilestone(46)?.type).toBe('batch_calendar_j46_plus');
  });

  it('retourne null pour un jour sans jalon (ex. J2, J20)', () => {
    expect(resolveCalendarMilestone(2)).toBeNull();
    expect(resolveCalendarMilestone(20)).toBeNull();
  });
});
