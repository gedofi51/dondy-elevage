export type ChickTransformationType = 'VENTE' | 'CHAIR' | 'RENOUVELLEMENT' | 'REFORME_PERTE';

/** Module lecture seule côté API — aucune écriture directe, les lignes
 * naissent exclusivement de POST /incubation-batches/:id/orientation.
 * Polymorphisme asymétrique : incubationBatchId est une FK dure (un seul
 * type de parent possible), childType/childId restent polymorphes (2
 * types d'entité enfant + le cas terminal REFORME_PERTE sans enfant). */
export interface BatchLineage {
  id: string;
  farmId: string;
  incubationBatchId: string;
  transformationType: ChickTransformationType;
  quantity: number;
  childType: 'chick_batch' | 'broiler_batch' | null;
  childId: string | null;
  /** Motif, uniquement renseigné pour REFORME_PERTE. */
  reason: string | null;
  date: string;
  createdAt: string;
  createdBy: string;
}

/** POST /incubation-batches/:incubationBatchId/orientation — un seul
 * endpoint, discriminant transformationType. Champs conditionnels
 * (@ValidateIf côté API) : buildingId requis pour CHAIR et RENOUVELLEMENT,
 * primaryManagerId requis pour CHAIR uniquement, reason requis pour
 * REFORME_PERTE uniquement. Union discriminée pour refléter ces
 * contraintes au niveau du type. */
export type CreateOrientationInput =
  | { transformationType: 'CHAIR'; quantity: number; buildingId: string; primaryManagerId: string }
  | { transformationType: 'RENOUVELLEMENT'; quantity: number; buildingId: string }
  | { transformationType: 'VENTE'; quantity: number }
  | { transformationType: 'REFORME_PERTE'; quantity: number; reason: string };
