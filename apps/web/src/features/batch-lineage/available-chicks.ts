import type { BatchLineage } from '@dondy-elevage/shared-types';

/** Réplique fidèle de la formule serveur (orientation.service.ts) —
 * aucun endpoint GET dédié n'expose ce solde. `chicksHatched` null =
 * bilan pas encore saisi, l'orientation est de toute façon bloquée côté
 * API dans ce cas (400) — retourne 0 plutôt que de risquer un nombre
 * négatif affiché. */
export function computeAvailableChicks(
  chicksHatched: number | null,
  lineageRows: BatchLineage[] | undefined,
): number {
  if (chicksHatched === null) return 0;
  const alreadyOriented = (lineageRows ?? []).reduce((sum, row) => sum + row.quantity, 0);
  return chicksHatched - alreadyOriented;
}
