import {
  detectBroilerCrossSignalAnomaly,
  type BroilerDailyRecordLike,
} from './broiler-anomaly.calculations';

function makeRecord(overrides: Partial<BroilerDailyRecordLike>): BroilerDailyRecordLike {
  return {
    dayNumber: 1,
    operatorId: 'user-1',
    mortalityQuantity: 1,
    feedDistributedKg: 50,
    waterConsumptionLiters: 80,
    ...overrides,
  };
}

// Fenêtre : J1-J3 (référence), J4-J6 (récent) ; jour courant = J7 (jamais évalué).
const BASELINE_DAYS = [1, 2, 3];
const RECENT_DAYS = [4, 5, 6];
const CURRENT_DAY = 7;

describe('detectBroilerCrossSignalAnomaly', () => {
  it('moins de 6 jours consécutifs saisis -> INSUFFISANT', () => {
    const result = detectBroilerCrossSignalAnomaly(
      [makeRecord({ dayNumber: 5 }), makeRecord({ dayNumber: 6 })],
      CURRENT_DAY,
      1000,
    );
    expect(result.dataStatus).toBe('INSUFFISANT');
    expect(result.triggered).toBe(false);
    expect(result.water).toBeNull();
  });

  it('journée non saisie (operatorId null) dans la fenêtre -> INSUFFISANT', () => {
    const records = [...BASELINE_DAYS, ...RECENT_DAYS].map((dayNumber) =>
      dayNumber === 5 ? makeRecord({ dayNumber, operatorId: null }) : makeRecord({ dayNumber }),
    );
    const result = detectBroilerCrossSignalAnomaly(records, CURRENT_DAY, 1000);
    expect(result.dataStatus).toBe('INSUFFISANT');
  });

  it('baisse eau + baisse aliment + hausse mortalité simultanées -> déclenché, décomposition complète', () => {
    const records = [
      ...BASELINE_DAYS.map((dayNumber) =>
        makeRecord({
          dayNumber,
          waterConsumptionLiters: 80,
          feedDistributedKg: 50,
          mortalityQuantity: 2,
        }),
      ),
      ...RECENT_DAYS.map((dayNumber) =>
        makeRecord({
          dayNumber,
          waterConsumptionLiters: 60,
          feedDistributedKg: 40,
          mortalityQuantity: 15,
        }),
      ),
    ];
    const result = detectBroilerCrossSignalAnomaly(records, CURRENT_DAY, 1000);
    expect(result.dataStatus).toBe('SUFFISANT');
    expect(result.recentDayRange).toEqual([4, 6]);
    expect(result.baselineDayRange).toEqual([1, 3]);
    expect(result.water!.triggered).toBe(true);
    expect(result.water!.changePercent).toBeCloseTo(-25, 5);
    expect(result.feed!.triggered).toBe(true);
    expect(result.feed!.changePercent).toBeCloseTo(-20, 5);
    expect(result.mortality!.triggered).toBe(true);
    expect(result.triggered).toBe(true);
  });

  it('seule la mortalité augmente (eau/aliment stables) -> non déclenché (règle croisée, pas un seuil isolé)', () => {
    const records = [
      ...BASELINE_DAYS.map((dayNumber) => makeRecord({ dayNumber, mortalityQuantity: 2 })),
      ...RECENT_DAYS.map((dayNumber) => makeRecord({ dayNumber, mortalityQuantity: 15 })),
    ];
    const result = detectBroilerCrossSignalAnomaly(records, CURRENT_DAY, 1000);
    expect(result.dataStatus).toBe('SUFFISANT');
    expect(result.mortality!.triggered).toBe(true);
    expect(result.water!.triggered).toBe(false);
    expect(result.feed!.triggered).toBe(false);
    expect(result.triggered).toBe(false);
  });

  it('eau non mesurée sur un jour de la fenêtre -> signal eau absent, jamais moyenné sur une valeur manquante', () => {
    const records = [
      ...BASELINE_DAYS.map((dayNumber) => makeRecord({ dayNumber })),
      makeRecord({
        dayNumber: 4,
        waterConsumptionLiters: null,
        feedDistributedKg: 40,
        mortalityQuantity: 15,
      }),
      makeRecord({ dayNumber: 5, feedDistributedKg: 40, mortalityQuantity: 15 }),
      makeRecord({ dayNumber: 6, feedDistributedKg: 40, mortalityQuantity: 15 }),
    ];
    const result = detectBroilerCrossSignalAnomaly(records, CURRENT_DAY, 1000);
    expect(result.dataStatus).toBe('SUFFISANT');
    expect(result.water).toBeNull();
    expect(result.triggered).toBe(false); // eau manquante -> règle 3 signaux ne peut pas se déclencher
  });
});
