/** §6.2/§6.3 : quantité d'œufs fécondés disponible pour incubation — jamais
 * stockée (voir BreederBatch), toujours dérivée du cumul sélectionné pour
 * incubation moins le cumul déjà consommé par des IncubationBatch. */
export function computeAvailableFertileEggs(
  cumulativeSelectedForIncubation: number,
  cumulativeConsumedByIncubation: number,
): number {
  return cumulativeSelectedForIncubation - cumulativeConsumedByIncubation;
}
