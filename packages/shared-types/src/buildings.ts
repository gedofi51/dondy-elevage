/** Référentiel simple (comme Incubator/Supplier) — hard delete côté
 * backend, garde ajoutée (BuildingsService.remove()) contre la suppression
 * d'un bâtiment utilisé par une bande ou un employé (voir
 * DETTE_TECHNIQUE.md, lot Bâtiments/Blocs). */
export interface Building {
  id: string;
  farmId: string;
  name: string;
  type: string;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateBuildingInput {
  name: string;
  type: string;
  capacity?: number;
}

export interface UpdateBuildingInput {
  name?: string;
  type?: string;
  capacity?: number;
}
