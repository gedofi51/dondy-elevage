import { safeDivide } from '../../../common/calculations/safe-math.util';

/** §6.3 : "Consommation cumulée = somme des quantités distribuées de J1 à aujourd'hui." */
export function computeCumulativeFeedConsumption(dailyQuantitiesKg: number[]): number {
  return dailyQuantitiesKg.reduce((sum, quantity) => sum + quantity, 0);
}

/** §6.3 : "Consommation moyenne/sujet = aliment cumulé / effectif moyen." */
export function computeAverageConsumptionPerSubject(
  cumulativeFeedKg: number,
  averageHeadcount: number,
): number {
  return safeDivide(cumulativeFeedKg, averageHeadcount);
}
