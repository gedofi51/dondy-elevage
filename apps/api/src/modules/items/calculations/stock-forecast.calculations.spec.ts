import { buildItemForecast, MIN_MOVEMENT_DAYS_FOR_FORECAST } from './stock-forecast.calculations';

const baseInput = {
  itemId: 'item-1',
  currentStock: 300,
  minThreshold: 100 as number | null,
  status: 'VERT' as const,
};

describe('buildItemForecast', () => {
  it('calcule autonomie/date de rupture/suggestion quand la donnée est suffisante', () => {
    const forecast = buildItemForecast({
      ...baseInput,
      totalSortieInWindow: 300, // 10/jour sur 30 jours
      movementDaysInWindow: 10,
    });

    expect(forecast.dataStatus).toBe('SUFFISANT');
    expect(forecast.averageDailyConsumption).toBe(10);
    expect(forecast.autonomyDays).toBe(30); // 300 / 10
    expect(forecast.estimatedStockoutDate).not.toBeNull();
    // Cible de couverture 30j à 10/jour = 300, stock actuel = 300 -> rien à suggérer.
    expect(forecast.suggestedReorderQuantity).toBeNull();
    expect(forecast.reorderBasis).toBeNull();
  });

  it('suggère une quantité basée sur la consommation quand le stock est sous la cible de couverture', () => {
    const forecast = buildItemForecast({
      ...baseInput,
      currentStock: 50,
      totalSortieInWindow: 300, // 10/jour
      movementDaysInWindow: 10,
    });

    expect(forecast.dataStatus).toBe('SUFFISANT');
    // Cible 30j à 10/jour = 300, stock = 50 -> suggestion = 250.
    expect(forecast.suggestedReorderQuantity).toBe(250);
    expect(forecast.reorderBasis).toBe('CONSOMMATION');
  });

  it(`retourne un état INSUFFISANT sous ${MIN_MOVEMENT_DAYS_FOR_FORECAST} dates de sortie distinctes`, () => {
    const forecast = buildItemForecast({
      ...baseInput,
      totalSortieInWindow: 50,
      movementDaysInWindow: 2,
    });

    expect(forecast.dataStatus).toBe('INSUFFISANT');
    expect(forecast.averageDailyConsumption).toBeNull();
    expect(forecast.autonomyDays).toBeNull();
    expect(forecast.estimatedStockoutDate).toBeNull();
  });

  it('jamais un chiffre inventé : aucune sortie du tout -> INSUFFISANT, pas 0 jour d’autonomie', () => {
    const forecast = buildItemForecast({
      ...baseInput,
      totalSortieInWindow: 0,
      movementDaysInWindow: 0,
    });

    expect(forecast.dataStatus).toBe('INSUFFISANT');
    expect(forecast.autonomyDays).toBeNull();
  });

  it('repli sur le seuil minimum quand la donnée est insuffisante mais le stock est déjà sous le seuil', () => {
    const forecast = buildItemForecast({
      ...baseInput,
      currentStock: 40,
      minThreshold: 100,
      totalSortieInWindow: 0,
      movementDaysInWindow: 0,
    });

    expect(forecast.dataStatus).toBe('INSUFFISANT');
    expect(forecast.suggestedReorderQuantity).toBe(60);
    expect(forecast.reorderBasis).toBe('SEUIL_MINIMUM');
  });

  it('aucune suggestion quand la donnée est insuffisante et le stock est déjà au-dessus du seuil (ou aucun seuil défini)', () => {
    const withThresholdOk = buildItemForecast({
      ...baseInput,
      currentStock: 200,
      minThreshold: 100,
      totalSortieInWindow: 0,
      movementDaysInWindow: 0,
    });
    expect(withThresholdOk.suggestedReorderQuantity).toBeNull();

    const withoutThreshold = buildItemForecast({
      ...baseInput,
      minThreshold: null,
      totalSortieInWindow: 0,
      movementDaysInWindow: 0,
    });
    expect(withoutThreshold.suggestedReorderQuantity).toBeNull();
  });

  it('reporte toujours windowDays/movementDaysInWindow, suffisant ou non', () => {
    const forecast = buildItemForecast({
      ...baseInput,
      totalSortieInWindow: 300,
      movementDaysInWindow: 10,
    });
    expect(forecast.windowDays).toBe(30);
    expect(forecast.movementDaysInWindow).toBe(10);
  });
});
