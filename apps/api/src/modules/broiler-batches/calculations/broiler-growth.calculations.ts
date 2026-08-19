import { safeDivide } from './safe-math.util';

/** §6.4 : "Poids moyen = poids total de l'échantillon / nombre d'animaux pesés." */
export function computeAverageWeightG(totalSampleWeightG: number, sampleSize: number): number {
  return safeDivide(totalSampleWeightG, sampleSize);
}

/**
 * §6.4 : "GMQ = (poids actuel - poids précédent) / nombre de jours."
 * `previousWeightG`/`numberOfDays` doivent provenir de la DERNIÈRE ligne
 * précédente avec un poids renseigné (toutes les journées ne sont pas
 * pesées) — cette recherche est à la charge de l'appelant (service), pas de
 * cette fonction pure.
 */
export function computeGmqGramsPerDay(
  currentWeightG: number,
  previousWeightG: number,
  numberOfDays: number,
): number {
  return safeDivide(currentWeightG - previousWeightG, numberOfDays);
}

/**
 * §6.4 : "IC = quantité d'aliment consommée / gain de poids vif."
 * Les deux arguments doivent être dans la même unité (kg) — la conversion
 * g -> kg du gain de poids est à la charge de l'appelant.
 */
export function computeFeedConversionRatio(
  feedConsumedKg: number,
  liveWeightGainKg: number,
): number {
  return safeDivide(feedConsumedKg, liveWeightGainKg);
}
