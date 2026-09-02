import { buildTreasuryForecast } from './treasury-forecast.calculations';

const PERIOD_START = new Date('2026-09-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-09-30T00:00:00.000Z');

describe('buildTreasuryForecast', () => {
  it('moins de 3 jours écoulés -> dataStatus INSUFFISANT, projected null, realized toujours présent', () => {
    const forecast = buildTreasuryForecast(
      {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        revenueToDateFcfa: 500_000,
        totalExpensesToDateFcfa: 300_000,
        netTreasuryToDateFcfa: 150_000,
      },
      new Date('2026-09-02T00:00:00.000Z'), // J2
    );
    expect(forecast.daysElapsed).toBe(2);
    expect(forecast.dataStatus).toBe('INSUFFISANT');
    expect(forecast.projected).toBeNull();
    expect(forecast.realized).toEqual({
      revenueFcfa: 500_000,
      totalExpensesFcfa: 300_000,
      netTreasuryFcfa: 150_000,
    });
  });

  it('10 jours écoulés sur 30 -> extrapolation linéaire (règle de trois), marge/rentabilité réutilisées', () => {
    // Réalisé à J10 : CA 500 000, charges 300 000 -> marge 200 000.
    // Run-rate = 30/10 = 3 -> CA projeté 1 500 000, charges 900 000,
    // marge projetée 600 000, rentabilité = 600000/900000*100 ≈ 66.67 %.
    const forecast = buildTreasuryForecast(
      {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        revenueToDateFcfa: 500_000,
        totalExpensesToDateFcfa: 300_000,
        netTreasuryToDateFcfa: 200_000,
      },
      new Date('2026-09-10T00:00:00.000Z'), // J10
    );
    expect(forecast.daysElapsed).toBe(10);
    expect(forecast.daysTotal).toBe(30);
    expect(forecast.dataStatus).toBe('SUFFISANT');
    expect(forecast.projected).not.toBeNull();
    expect(forecast.projected!.revenueFcfa).toBe(1_500_000);
    expect(forecast.projected!.totalExpensesFcfa).toBe(900_000);
    expect(forecast.projected!.grossMarginFcfa).toBe(600_000);
    expect(forecast.projected!.profitabilityRate).toBeCloseTo((600_000 / 900_000) * 100, 5);
    expect(forecast.projected!.netTreasuryFcfa).toBe(600_000);
  });

  it('trésorerie nette réalisée négative -> besoin de trésorerie projeté négatif, jamais masqué', () => {
    const forecast = buildTreasuryForecast(
      {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        revenueToDateFcfa: 100_000,
        totalExpensesToDateFcfa: 400_000,
        netTreasuryToDateFcfa: -300_000,
      },
      new Date('2026-09-10T00:00:00.000Z'),
    );
    expect(forecast.projected!.netTreasuryFcfa).toBe(-900_000);
  });

  it('daysElapsed ne dépasse jamais daysTotal (lecture après la fin du mois)', () => {
    const forecast = buildTreasuryForecast(
      {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        revenueToDateFcfa: 900_000,
        totalExpensesToDateFcfa: 600_000,
        netTreasuryToDateFcfa: 300_000,
      },
      new Date('2026-10-05T00:00:00.000Z'),
    );
    expect(forecast.daysElapsed).toBe(30);
    expect(forecast.projected!.revenueFcfa).toBe(900_000); // run-rate = 1
  });

  it('période et horodatage toujours présents', () => {
    const forecast = buildTreasuryForecast(
      {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        revenueToDateFcfa: 0,
        totalExpensesToDateFcfa: 0,
        netTreasuryToDateFcfa: 0,
      },
      new Date('2026-09-01T00:00:00.000Z'),
    );
    expect(forecast.periodStart).toBe(PERIOD_START.toISOString());
    expect(forecast.periodEnd).toBe(PERIOD_END.toISOString());
    expect(forecast.calculatedAt).toBe(new Date('2026-09-01T00:00:00.000Z').toISOString());
  });
});
