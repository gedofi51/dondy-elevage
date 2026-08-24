export type IncubationBatchStatus = 'EN_INCUBATION' | 'ECLOS' | 'CLOTURE' | 'ANNULEE';

/** EN_INCUBATION/ECLOS sont modifiables librement par PATCH ; CLOTURE/
 * ANNULEE ne devraient passer que par les endpoints dédiés (/cloturer,
 * /annuler) — convention documentée côté API mais non appliquée par le
 * service. Ces deux endpoints existent mais sont différés côté frontend
 * cette phase (aucune couverture e2e, et annuler recrédite silencieusement
 * les œufs du lot reproducteur parent même après orientation — voir
 * DETTE_TECHNIQUE.md Phase 13). */
export const INCUBATION_BATCH_EDITABLE_STATUSES = [
  'EN_INCUBATION',
  'ECLOS',
] as const satisfies readonly IncubationBatchStatus[];

export interface IncubationBatch {
  id: string;
  farmId: string;
  code: string;
  breederBatchId: string;
  incubatorId: string;
  incubationStartDate: string;
  eggCount: number;
  actualHatchDate: string | null;
  eggsInfertile: number | null;
  eggsInfected: number | null;
  embryonicMortality: number | null;
  chicksHatched: number | null;
  remarks: string | null;
  status: IncubationBatchStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** expectedHatchDate/expectedCandlingDate calculés à la lecture depuis
 * incubationStartDate + réglages de ferme (jamais persistés). Les 4 KPI
 * couvoir (taux d'éclosion/fécondité/mortalité embryonnaire/infection) ne
 * sont PAS attachés ici — jamais exposés par aucune route, à recalculer
 * côté client (voir features/incubation-batches/kpi.ts). */
export interface IncubationBatchWithComputed extends IncubationBatch {
  expectedHatchDate: string;
  expectedCandlingDate: string;
}

export interface CreateIncubationBatchInput {
  breederBatchId: string;
  incubatorId: string;
  incubationStartDate: string;
  eggCount: number;
  remarks?: string;
}

/** breederBatchId/eggCount volontairement absents : filiation et quantité
 * incubée figées à la création (commentaire UpdateIncubationBatchDto). Le
 * bilan de mirage/éclosion (actualHatchDate..chicksHatched) partage ce
 * même DTO — pas d'endpoint dédié côté API, donc un seul formulaire
 * frontend plutôt qu'une scission artificielle. */
export interface UpdateIncubationBatchInput {
  incubatorId?: string;
  incubationStartDate?: string;
  actualHatchDate?: string;
  eggsInfertile?: number;
  eggsInfected?: number;
  embryonicMortality?: number;
  chicksHatched?: number;
  remarks?: string;
  status?: IncubationBatchStatus;
}

/** Renvoyé par GET /:id/profitability — CA compte uniquement les
 * orientations VENTE (chick_batch), CHAIR/RENOUVELLEMENT exclus
 * délibérément (évite un double comptage avec le P&L de la bande
 * destinataire). */
export interface IncubationBatchProfitability {
  totalExpensesFcfa: number;
  revenueFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
  costPerChickHatchedFcfa: number;
}
