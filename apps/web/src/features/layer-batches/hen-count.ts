import type { LayerDailyRecord } from '@dondy-elevage/shared-types';

/** Reproduit exactement `computeSuggestedHenCount` côté backend
 * (layer-headcount.calculations.ts) — le backend calcule cette suggestion
 * au POST mais ne l'expose JAMAIS en lecture (seulement journalisée dans
 * l'audit log) : recalculée ici à partir de la liste déjà chargée des
 * journées existantes, pas un second appel réseau. Aucune borne à zéro
 * (même comportement que le backend). */
export function computeSuggestedHenCount(
  records: LayerDailyRecord[] | undefined,
  initialQuantity: number,
  date: string,
): number {
  const target = new Date(date).getTime();
  const previous = (records ?? [])
    .filter((r) => new Date(r.date).getTime() < target)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (!previous) return initialQuantity;
  return (
    previous.henCount - previous.mortalityQuantity - previous.cullsQuantity - previous.otherExitsQuantity
  );
}
