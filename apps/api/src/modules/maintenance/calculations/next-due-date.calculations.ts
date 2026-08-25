/**
 * Prochaine échéance de maintenance préventive (cahier V6 §7 : "prochaine
 * maintenance calculée automatiquement") — dérivée de la dernière
 * intervention réelle du plan + sa périodicité (jamais d'une tâche
 * annulée, pour ne pas laisser le planning dériver silencieusement en
 * l'absence de toute maintenance réelle). Voir DETTE_TECHNIQUE.md
 * Phase 17, décision C.1/C.7 : périodicité en jours entiers, hypothèse
 * d'ingénierie documentée (le cahier ne donne aucune unité/formule).
 *
 * Dates manipulées en UTC (même discipline que
 * depreciation.calculations.ts, Phase 16) — `lastAnchorDate` provient
 * systématiquement d'un champ DateTime Prisma (déjà UTC), aucune
 * conversion locale ne doit intervenir ici.
 */

const MS_PER_DAY = 86_400_000;

export function computeNextDueDate(lastAnchorDate: Date, periodicityDays: number): Date {
  if (periodicityDays < 1) {
    throw new Error('periodicityDays doit être >= 1 (garanti par le DTO en amont).');
  }
  return new Date(lastAnchorDate.getTime() + periodicityDays * MS_PER_DAY);
}
