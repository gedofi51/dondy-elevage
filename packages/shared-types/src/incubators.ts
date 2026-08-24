/** Référentiel simple (comme Building/Supplier) — pas de statut actif/
 * inactif, hard delete. remove() ne vérifie pas l'existence de
 * IncubationBatch liés avant suppression (gap backend, voir
 * DETTE_TECHNIQUE.md Phase 13) : une suppression sur une couveuse en
 * cours d'usage peut échouer avec une erreur non interceptée proprement. */
export interface Incubator {
  id: string;
  farmId: string;
  name: string;
  capacityEggs: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateIncubatorInput {
  name: string;
  capacityEggs?: number;
  notes?: string;
}

export interface UpdateIncubatorInput {
  name?: string;
  capacityEggs?: number;
  notes?: string;
}
