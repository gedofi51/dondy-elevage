const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** §6.3 : "Date d'éclosion prévue = calcul, environ 21 jours pour poule."
 * Jamais persistée (voir IncubationBatch), toujours dérivée. */
export function computeExpectedHatchDate(incubationStartDate: Date, durationDays: number): Date {
  return new Date(incubationStartDate.getTime() + durationDays * MS_PER_DAY);
}

/** §6.6 : "Date de mirage à échéance." Jamais persistée. */
export function computeExpectedCandlingDate(
  incubationStartDate: Date,
  candlingDayOffset: number,
): Date {
  return new Date(incubationStartDate.getTime() + candlingDayOffset * MS_PER_DAY);
}
