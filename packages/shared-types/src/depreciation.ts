/** Générées atomiquement à la création de l'Asset (même transaction),
 * jamais créées/modifiées indépendamment — voir DETTE_TECHNIQUE.md
 * Phase 16 pour le modèle de calendrier fiscal (prorata temporis) retenu.
 * Lecture seule côté API (aucun endpoint de création/modification dédié). */
export interface DepreciationEntry {
  id: string;
  farmId: string;
  assetId: string;
  periodNumber: number;
  periodStart: string;
  periodEnd: string;
  dotationFcfa: number;
  cumulativeFcfa: number;
  netBookValueFcfa: number;
  createdAt: string;
}
