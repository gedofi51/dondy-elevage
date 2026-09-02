import { buildLayerForecast } from './layer-forecast.calculations';

const NOW = new Date('2026-09-15T00:00:00.000Z');

describe('buildLayerForecast', () => {
  it('moins de 3 journées saisies dans la fenêtre -> dataStatus INSUFFISANT', () => {
    const forecast = buildLayerForecast(
      {
        batchId: 'batch-1',
        totalEggsLaidInWindow: 1800,
        recordDaysInWindow: 2,
        currentHeadcount: 1000,
      },
      NOW,
    );
    expect(forecast.dataStatus).toBe('INSUFFISANT');
    expect(forecast.averageDailyEggs).toBeNull();
    expect(forecast.projectedEggsNextWindow).toBeNull();
    expect(forecast.projectedLayingRatePercent).toBeNull();
  });

  it('effectif nul (lot pas encore en ponte) -> INSUFFISANT même avec des journées saisies', () => {
    const forecast = buildLayerForecast(
      {
        batchId: 'batch-1',
        totalEggsLaidInWindow: 0,
        recordDaysInWindow: 5,
        currentHeadcount: 0,
      },
      NOW,
    );
    expect(forecast.dataStatus).toBe('INSUFFISANT');
  });

  it('données suffisantes -> moyenne/j, projection 30j et taux de ponte projeté cohérents', () => {
    // 27 000 œufs sur 30 jours = 900/jour ; 900/1000 poules * 100 = 90 %.
    const forecast = buildLayerForecast(
      {
        batchId: 'batch-1',
        totalEggsLaidInWindow: 27_000,
        recordDaysInWindow: 30,
        currentHeadcount: 1000,
      },
      NOW,
    );
    expect(forecast.dataStatus).toBe('SUFFISANT');
    expect(forecast.windowDays).toBe(30);
    expect(forecast.averageDailyEggs).toBe(900);
    expect(forecast.projectedEggsNextWindow).toBe(27_000);
    expect(forecast.projectedLayingRatePercent).toBeCloseTo(90, 5);
  });

  it('exactement au seuil de suffisance (3 journées) -> SUFFISANT', () => {
    const forecast = buildLayerForecast(
      {
        batchId: 'batch-1',
        totalEggsLaidInWindow: 2700,
        recordDaysInWindow: 3,
        currentHeadcount: 1000,
      },
      NOW,
    );
    expect(forecast.dataStatus).toBe('SUFFISANT');
  });

  it('horodatage et fenêtre toujours présents', () => {
    const forecast = buildLayerForecast(
      {
        batchId: 'batch-1',
        totalEggsLaidInWindow: 0,
        recordDaysInWindow: 0,
        currentHeadcount: 1000,
      },
      NOW,
    );
    expect(forecast.calculatedAt).toBe(NOW.toISOString());
    expect(forecast.windowDays).toBe(30);
    expect(forecast.recordDaysInWindow).toBe(0);
  });
});
