export type BreederBatchStatus = 'ACTIF' | 'REFORME' | 'CLOTURE' | 'ANNULEE';

/** ACTIF/REFORME sont modifiables librement par PATCH ; CLOTURE/ANNULEE ne
 * devraient passer que par les endpoints dédiés (/cloturer, /annuler) —
 * convention documentée côté API (commentaire UpdateBreederBatchDto) mais
 * non appliquée par le service. Ces deux endpoints existent mais sont
 * différés côté frontend cette phase (aucune couverture e2e — voir
 * DETTE_TECHNIQUE.md Phase 13), donc aucun bouton Clôturer/Annuler n'est
 * construit ; le formulaire de modification n'affiche que ce sous-ensemble
 * et la garde isBatchOpen reste appliquée défensivement sur Modifier. */
export const BREEDER_BATCH_EDITABLE_STATUSES = [
  'ACTIF',
  'REFORME',
] as const satisfies readonly BreederBatchStatus[];

export interface BreederBatch {
  id: string;
  farmId: string;
  code: string;
  strain: string | null;
  constitutionDate: string;
  femaleCount: number;
  maleCount: number;
  buildingId: string;
  /** Option A (Bâtiments/Blocs) — additif/facultatif. */
  blockId: string | null;
  primaryManagerId: string;
  status: BreederBatchStatus;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** availableFertileEggs calculé côté service à chaque lecture (jamais
 * stocké) = cumul eggsSelectedForIncubation des journées - cumul eggCount
 * des IncubationBatch non-ANNULEE issus de ce lot. */
export interface BreederBatchWithComputed extends BreederBatch {
  availableFertileEggs: number;
}

export interface CreateBreederBatchInput {
  strain?: string;
  constitutionDate: string;
  femaleCount: number;
  maleCount: number;
  buildingId: string;
  blockId?: string;
  primaryManagerId: string;
  observations?: string;
}

export interface UpdateBreederBatchInput {
  strain?: string;
  constitutionDate?: string;
  femaleCount?: number;
  maleCount?: number;
  buildingId?: string;
  blockId?: string | null;
  primaryManagerId?: string;
  status?: BreederBatchStatus;
  observations?: string;
}

/** Créé À LA DEMANDE et adressé par date ISO (comme LayerDailyRecord) —
 * GET/PATCH uniquement, pas de DELETE, date immuable une fois la ligne
 * créée. Pas de champ mortalité/décrément d'effectif (femaleCount/
 * maleCount restent statiques, corrigibles uniquement par PATCH du lot) et
 * pas de valeur suggérée à recalculer côté client (contrairement à
 * henCount côté Layer — aucune formule de report n'existe côté API). */
export interface BreederDailyRecord {
  id: string;
  farmId: string;
  batchId: string;
  date: string;
  operatorId: string | null;
  eggsLaid: number;
  eggsSelectedForIncubation: number;
  eggsRejected: number;
  eggsSold: number;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBreederDailyRecordInput {
  date: string;
  eggsLaid: number;
  eggsSelectedForIncubation?: number;
  eggsRejected?: number;
  eggsSold?: number;
  observations?: string;
}

export interface UpdateBreederDailyRecordInput {
  eggsLaid?: number;
  eggsSelectedForIncubation?: number;
  eggsRejected?: number;
  eggsSold?: number;
  observations?: string;
}
