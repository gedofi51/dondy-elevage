/** Aucun endpoint "jour courant" côté API (les 45 lignes sont pré-générées
 * à la création, adressées par dayNumber) — ce calcul est répliqué ici en
 * un seul endroit, utilisé partout où "aujourd'hui" doit être résolu en
 * ligne de suivi quotidien (tableau des bandes, bouton "Saisir
 * aujourd'hui", agrégat mortalité du jour du dashboard). Jamais utilisé
 * pour recalculer une donnée déjà fournie par le serveur — uniquement pour
 * savoir QUELLE ligne pré-existante consulter. */
export const DAILY_CYCLE_LENGTH = 45;

export function computeDayNumber(arrivalDate: string, today: Date = new Date()): number {
  const startOfToday = new Date(today).setHours(0, 0, 0, 0);
  const startOfArrival = new Date(arrivalDate).setHours(0, 0, 0, 0);
  return Math.floor((startOfToday - startOfArrival) / 86_400_000) + 1;
}

export function isDayNumberInCycle(dayNumber: number): boolean {
  return dayNumber >= 1 && dayNumber <= DAILY_CYCLE_LENGTH;
}
