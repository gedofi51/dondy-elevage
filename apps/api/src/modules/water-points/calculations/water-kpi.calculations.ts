import { safeDivide } from '../../../common/calculations/safe-math.util';

/** §7.5 : "Consommation moyenne par point d'eau." */
export function computeAverageConsumptionPerPointM3(
  totalConsumptionM3: number,
  readingCount: number,
): number {
  return safeDivide(totalConsumptionM3, readingCount);
}

/**
 * §7.5 : "Disponibilité du point d'eau." Interprétée, faute de capteur
 * IoT réel (hors périmètre V5, comme pour la couveuse), comme le taux de
 * jours avec un relevé enregistré sur une période donnée.
 */
export function computeAvailabilityRatePercent(
  daysWithReading: number,
  totalDaysInPeriod: number,
): number {
  return safeDivide(daysWithReading, totalDaysInPeriod) * 100;
}
