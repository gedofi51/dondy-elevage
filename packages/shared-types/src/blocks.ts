/** Sous-unité optionnelle d'un Bâtiment (Option A — additif, facultatif,
 * voir DETTE_TECHNIQUE.md, investigation Bâtiments/Blocs). CRUD simple
 * nom/code, buildingId non modifiable après création (UpdateBlockInput). */
export interface Block {
  id: string;
  farmId: string;
  buildingId: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateBlockInput {
  buildingId: string;
  name: string;
  code?: string;
}

export interface UpdateBlockInput {
  name?: string;
  code?: string;
}
