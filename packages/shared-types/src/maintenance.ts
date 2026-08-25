export type MaintenanceTaskType = 'PREVENTIVE' | 'CORRECTIVE' | 'CONDITIONNELLE';

export type MaintenanceTaskStatus = 'A_FAIRE' | 'EN_COURS' | 'REALISEE' | 'ANNULEE';

/** REALISEE/ANNULEE sont des statuts terminaux, jamais atteignables via PATCH
 * générique — REALISEE est un effet de bord transactionnel de la création
 * d'une MaintenanceIntervention (taskId fourni), ANNULEE ne s'atteint que
 * via POST /maintenance-tasks/:id/annuler (voir DETTE_TECHNIQUE.md Phase 17,
 * même discipline que ASSET_EDITABLE_STATUSES en Phase 16). */
export const MAINTENANCE_TASK_EDITABLE_STATUSES = ['A_FAIRE', 'EN_COURS'] as const;

export interface MaintenancePlan {
  id: string;
  farmId: string;
  assetId: string;
  designation: string;
  periodicityDays: number;
  startDate: string;
  active: boolean;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateMaintenancePlanInput {
  assetId: string;
  designation: string;
  periodicityDays: number;
  startDate: string;
  observations?: string;
}

export interface UpdateMaintenancePlanInput {
  designation?: string;
  periodicityDays?: number;
  active?: boolean;
  observations?: string;
}

export interface MaintenanceTask {
  id: string;
  farmId: string;
  assetId: string;
  planId: string | null;
  type: MaintenanceTaskType;
  designation: string;
  dueDate: string;
  status: MaintenanceTaskStatus;
  cancelReason: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** `isLate` : calculé à la lecture (dueDate < aujourd'hui ET statut encore
 * A_FAIRE/EN_COURS) — jamais stocké, voir DETTE_TECHNIQUE.md Phase 17. */
export interface MaintenanceTaskWithComputed extends MaintenanceTask {
  isLate: boolean;
}

/** Création manuelle uniquement — planId est toujours null pour une tâche
 * créée par ce endpoint (corrective/conditionnelle) ; les tâches
 * préventives sont générées par le système, jamais par ce endpoint. */
export interface CreateMaintenanceTaskInput {
  assetId: string;
  type: 'CORRECTIVE' | 'CONDITIONNELLE';
  designation: string;
  dueDate: string;
  observations?: string;
}

export interface UpdateMaintenanceTaskInput {
  designation?: string;
  dueDate?: string;
  status?: (typeof MAINTENANCE_TASK_EDITABLE_STATUSES)[number];
  observations?: string;
}

export interface CancelMaintenanceTaskInput {
  cancelReason?: string;
}

export interface MaintenanceInterventionPartInput {
  itemId: string;
  quantity: number;
}

export interface MaintenanceIntervention {
  id: string;
  farmId: string;
  assetId: string;
  taskId: string | null;
  interventionDate: string;
  diagnosis: string | null;
  laborCostFcfa: number;
  performedBy: string | null;
  createdAt: string;
  createdBy: string | null;
}

/** `partsCostFcfa`/`totalCostFcfa` : dérivés à la lecture depuis les
 * StockMovement liés (sourceType='maintenance_intervention'), jamais
 * stockés — même philosophie que Asset.attachComputed(). */
export interface MaintenanceInterventionWithComputed extends MaintenanceIntervention {
  partsCostFcfa: number;
  totalCostFcfa: number;
}

export interface CreateMaintenanceInterventionInput {
  assetId: string;
  taskId?: string;
  interventionDate: string;
  diagnosis?: string;
  laborCostFcfa?: number;
  performedBy?: string;
  parts?: MaintenanceInterventionPartInput[];
}
