import { buildBroilerForecast } from './broiler-forecast.calculations';

const NOW = new Date('2026-09-15T00:00:00.000Z');
const ARRIVAL_10_DAYS_AGO = new Date('2026-09-05T00:00:00.000Z');
const PLANNED_SALE_IN_35_DAYS = new Date('2026-10-20T00:00:00.000Z');

describe('buildBroilerForecast', () => {
  it('moins de 3 jours écoulés -> mortalityDataStatus INSUFFISANT, aucun chiffre projeté', () => {
    const forecast = buildBroilerForecast(
      {
        batchId: 'batch-1',
        arrivalDate: new Date('2026-09-14T00:00:00.000Z'),
        plannedSaleDate: PLANNED_SALE_IN_35_DAYS,
        startedQuantity: 1000,
        currentHeadcount: 998,
        cumulativeMortality: 2,
        latestWeighing: null,
        previousWeighing: null,
      },
      NOW,
    );
    expect(forecast.elapsedDays).toBe(1);
    expect(forecast.mortalityDataStatus).toBe('INSUFFISANT');
    expect(forecast.projectedAdditionalMortality).toBeNull();
    expect(forecast.projectedSellableCount).toBeNull();
  });

  it('mortalité régulière sur 10 jours -> extrapolation linéaire sur les jours restants', () => {
    // 20 morts / 10 jours = 2/jour ; reste 35 jours -> +70 morts projetées.
    const forecast = buildBroilerForecast(
      {
        batchId: 'batch-1',
        arrivalDate: ARRIVAL_10_DAYS_AGO,
        plannedSaleDate: PLANNED_SALE_IN_35_DAYS,
        startedQuantity: 1000,
        currentHeadcount: 980,
        cumulativeMortality: 20,
        latestWeighing: null,
        previousWeighing: null,
      },
      NOW,
    );
    expect(forecast.elapsedDays).toBe(10);
    expect(forecast.remainingDays).toBe(35);
    expect(forecast.mortalityDataStatus).toBe('SUFFISANT');
    expect(forecast.projectedAdditionalMortality).toBe(70);
    expect(forecast.projectedSellableCount).toBe(910); // 980 - 70
  });

  it('projection de mortalité jamais négative même si le taux extrapolé dépasse l’effectif restant', () => {
    const forecast = buildBroilerForecast(
      {
        batchId: 'batch-1',
        arrivalDate: ARRIVAL_10_DAYS_AGO,
        plannedSaleDate: PLANNED_SALE_IN_35_DAYS,
        startedQuantity: 1000,
        currentHeadcount: 50,
        cumulativeMortality: 950,
        latestWeighing: null,
        previousWeighing: null,
      },
      NOW,
    );
    expect(forecast.projectedSellableCount).toBe(0);
  });

  it('une seule pesée enregistrée -> weightDataStatus INSUFFISANT', () => {
    const forecast = buildBroilerForecast(
      {
        batchId: 'batch-1',
        arrivalDate: ARRIVAL_10_DAYS_AGO,
        plannedSaleDate: PLANNED_SALE_IN_35_DAYS,
        startedQuantity: 1000,
        currentHeadcount: 980,
        cumulativeMortality: 20,
        latestWeighing: { dayNumber: 10, averageWeightG: 250 },
        previousWeighing: null,
      },
      NOW,
    );
    expect(forecast.weightDataStatus).toBe('INSUFFISANT');
    expect(forecast.gmqTrendGramsPerDay).toBeNull();
    expect(forecast.projectedFinalWeightG).toBeNull();
  });

  it('2 pesées -> GMQ tendance réutilisé (computeGmqGramsPerDay), poids final projeté', () => {
    // 250g à J10, 100g à J5 -> GMQ = 150/5 = 30 g/j ; reste 35 jours -> 250 + 30*35 = 1300g.
    const forecast = buildBroilerForecast(
      {
        batchId: 'batch-1',
        arrivalDate: ARRIVAL_10_DAYS_AGO,
        plannedSaleDate: PLANNED_SALE_IN_35_DAYS,
        startedQuantity: 1000,
        currentHeadcount: 980,
        cumulativeMortality: 20,
        latestWeighing: { dayNumber: 10, averageWeightG: 250 },
        previousWeighing: { dayNumber: 5, averageWeightG: 100 },
      },
      NOW,
    );
    expect(forecast.weightDataStatus).toBe('SUFFISANT');
    expect(forecast.gmqTrendGramsPerDay).toBe(30);
    expect(forecast.projectedFinalWeightG).toBe(1300);
  });

  it('lot déjà au-delà de plannedSaleDate -> remainingDays à 0, pas de mortalité additionnelle projetée', () => {
    const forecast = buildBroilerForecast(
      {
        batchId: 'batch-1',
        arrivalDate: ARRIVAL_10_DAYS_AGO,
        plannedSaleDate: new Date('2026-09-10T00:00:00.000Z'),
        startedQuantity: 1000,
        currentHeadcount: 980,
        cumulativeMortality: 20,
        latestWeighing: { dayNumber: 10, averageWeightG: 250 },
        previousWeighing: { dayNumber: 5, averageWeightG: 100 },
      },
      NOW,
    );
    expect(forecast.remainingDays).toBe(0);
    expect(forecast.projectedAdditionalMortality).toBe(0);
    expect(forecast.projectedSellableCount).toBe(980);
    expect(forecast.projectedFinalWeightG).toBe(250);
  });

  it('période de référence et horodatage toujours présents', () => {
    const forecast = buildBroilerForecast(
      {
        batchId: 'batch-1',
        arrivalDate: ARRIVAL_10_DAYS_AGO,
        plannedSaleDate: PLANNED_SALE_IN_35_DAYS,
        startedQuantity: 1000,
        currentHeadcount: 980,
        cumulativeMortality: 20,
        latestWeighing: null,
        previousWeighing: null,
      },
      NOW,
    );
    expect(forecast.referenceStart).toBe(ARRIVAL_10_DAYS_AGO.toISOString());
    expect(forecast.referenceEnd).toBe(PLANNED_SALE_IN_35_DAYS.toISOString());
    expect(forecast.calculatedAt).toBe(NOW.toISOString());
  });
});
