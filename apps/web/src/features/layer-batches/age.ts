/** Âge affiché en semaines — calcul purement d'affichage (contrairement à
 * BroilerBatch.dayNumber, ce n'est pas une donnée métier recalculée : le
 * taux de ponte/GMQ restent exclusivement dérivés côté serveur, voir
 * principe directeur CLAUDE.md). Combine l'âge à l'entrée saisi
 * (ageAtEntryWeeks/Days) et le temps écoulé depuis l'entrée dans le lot. */
export function computeCurrentAgeWeeks(
  entryDate: string,
  ageAtEntryWeeks: number | null,
  ageAtEntryDays: number | null,
): number {
  const daysSinceEntry = Math.floor((Date.now() - new Date(entryDate).getTime()) / 86_400_000);
  const totalDaysAtEntry = (ageAtEntryWeeks ?? 0) * 7 + (ageAtEntryDays ?? 0);
  return Math.floor((totalDaysAtEntry + Math.max(daysSinceEntry, 0)) / 7);
}
