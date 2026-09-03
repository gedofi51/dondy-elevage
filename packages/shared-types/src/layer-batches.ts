import type { HealthEventRoute, HealthEventStatus, HealthEventType } from './broiler-batches';

export type LayerBatchStatus = 'ELEVAGE' | 'PONTE' | 'REFORME' | 'CLOTURE' | 'ANNULEE';

/** ELEVAGE/PONTE/REFORME sont modifiables librement par PATCH ; CLOTURE/
 * ANNULEE ne devraient passer que par les endpoints dédiés (/cloturer,
 * /annuler) — convention documentée côté API mais non appliquée par
 * UpdateLayerBatchDto/service (même dette que BroilerBatch, voir
 * DETTE_TECHNIQUE.md, catégorie "Statuts terminaux non protégés"). Le
 * formulaire de modification n'affiche donc que ce sous-ensemble. */
export const LAYER_BATCH_EDITABLE_STATUSES = [
  'ELEVAGE',
  'PONTE',
  'REFORME',
] as const satisfies readonly LayerBatchStatus[];

export interface LayerBatch {
  id: string;
  farmId: string;
  code: string;
  strain: string | null;
  entryDate: string;
  initialQuantity: number;
  ageAtEntryWeeks: number | null;
  ageAtEntryDays: number | null;
  buildingId: string;
  primaryManagerId: string;
  status: LayerBatchStatus;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** currentHeadcount calculé côté service à chaque lecture (jamais
 * recalculé côté client — voir principe directeur CLAUDE.md). */
export interface LayerBatchWithComputed extends LayerBatch {
  currentHeadcount: number;
}

export interface CreateLayerBatchInput {
  entryDate: string;
  strain?: string;
  initialQuantity: number;
  ageAtEntryWeeks?: number;
  ageAtEntryDays?: number;
  buildingId: string;
  primaryManagerId: string;
  observations?: string;
}

export interface UpdateLayerBatchInput {
  entryDate?: string;
  strain?: string;
  initialQuantity?: number;
  ageAtEntryWeeks?: number;
  ageAtEntryDays?: number;
  buildingId?: string;
  primaryManagerId?: string;
  status?: LayerBatchStatus;
  observations?: string;
}

/** Créé À LA DEMANDE et adressé par date ISO (pas de dayNumber, pas de
 * lignes pré-générées comme BroilerDailyRecord) — GET/PATCH uniquement,
 * pas de DELETE, date immuable une fois la ligne créée. henCount est
 * PERSISTÉ (contrairement à LayerBatch.currentHeadcount) : le service
 * calcule une suggestion (veille - sorties de la veille) mais ne l'expose
 * jamais en lecture — à recalculer côté client si besoin d'affichage.
 * Champs Decimal Prisma sérialisés en string. */
export interface LayerDailyRecord {
  id: string;
  farmId: string;
  batchId: string;
  date: string;
  operatorId: string | null;
  henCount: number;
  mortalityQuantity: number;
  cullsQuantity: number;
  otherExitsQuantity: number;
  eggsLaid: number;
  eggsBroken: number;
  eggsRejected: number;
  eggsSellable: number;
  layingRatePercent: string | null;
  feedDistributedKg: string | null;
  /** null explicite déclenche un retour de stock côté serveur si un item
   * était précédemment renseigné — mapper ''→null à la soumission. */
  feedItemId: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLayerDailyRecordInput {
  date: string;
  feedItemId?: string;
  /** Si omis, le service calcule une suggestion (veille - sorties de la
   * veille, ou effectif initial du lot pour la toute première journée). */
  henCount?: number;
  mortalityQuantity?: number;
  cullsQuantity?: number;
  otherExitsQuantity?: number;
  eggsLaid: number;
  eggsBroken?: number;
  eggsRejected?: number;
  feedDistributedKg?: number;
  observations?: string;
}

export interface UpdateLayerDailyRecordInput {
  /** `null` déclenche un retour de stock si un item était renseigné avant. */
  feedItemId?: string | null;
  henCount?: number;
  mortalityQuantity?: number;
  cullsQuantity?: number;
  otherExitsQuantity?: number;
  eggsLaid?: number;
  eggsBroken?: number;
  eggsRejected?: number;
  feedDistributedKg?: number;
  observations?: string;
}

/** Duplicata strict de BroilerHealthEvent côté backend (mêmes champs,
 * mêmes enums réutilisés) — seule la table est dupliquée, pas le modèle. */
export interface LayerHealthEvent {
  id: string;
  farmId: string;
  batchId: string;
  date: string;
  status: HealthEventStatus;
  type: HealthEventType;
  product: string | null;
  motif: string | null;
  dose: string | null;
  quantity: string | null;
  unit: string | null;
  durationDays: number | null;
  administrationRoute: HealthEventRoute | null;
  prescribedBy: string | null;
  performedBy: string | null;
  costFcfa: number | null;
  observation: string | null;
  itemId: string | null;
  quantityUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLayerHealthEventInput {
  date: string;
  type: HealthEventType;
  itemId?: string;
  quantityUsed?: number;
  status?: HealthEventStatus;
  product?: string;
  motif?: string;
  dose?: string;
  quantity?: string;
  unit?: string;
  durationDays?: number;
  administrationRoute?: HealthEventRoute;
  prescribedBy?: string;
  performedBy?: string;
  costFcfa?: number;
  observation?: string;
}

export type LayerForecastDataStatus = 'SUFFISANT' | 'INSUFFISANT';

/**
 * Prévisions production (Lot 3) — GET /layer-batches/previsions. Fenêtre
 * glissante de 30 jours (même convention que Lot 2, items), uniquement
 * sur les lots ELEVAGE/PONTE (REFORME/CLOTURE/ANNULEE exclus côté
 * service — cycle terminé, rien à projeter).
 */
export interface LayerForecast {
  batchId: string;
  windowDays: number;
  recordDaysInWindow: number;
  dataStatus: LayerForecastDataStatus;
  averageDailyEggs: number | null;
  projectedEggsNextWindow: number | null;
  projectedLayingRatePercent: number | null;
  calculatedAt: string;
}

/** Renvoyé par GET /:id/profitability (lecture pure, à tout moment sur un
 * lot actif) ET par la réponse de POST /:id/cloturer (même forme) — un
 * seul type pour les deux usages. Structure différente de
 * BatchClosureSummary (Broiler) : pas de GMQ/IC (aucune notion équivalente
 * pour les pondeuses), section stock en plus. `performance` limitée à la
 * mortalité cumulée (ajoutée Lot 5, score de performance — jamais exposée
 * avant ce lot, voir DETTE_TECHNIQUE.md). */
export interface LayerBatchClosureSummary {
  production: {
    initialQuantity: number;
    currentHeadcount: number;
    cumulativeEggsLaid: number;
    cumulativeEggsSellable: number;
    cumulativeEggsSold: number;
    averageLayingRatePercent: number;
    daysTracked: number;
  };
  performance: {
    cumulativeMortalityRate: number;
  };
  stock: {
    /** Non bloquant pour la clôture — signalé si non nul. */
    remainingEggStock: number;
  };
  finances: {
    totalExpensesFcfa: number;
    revenueFcfa: number;
    grossMarginFcfa: number;
    costPerEggFcfa: number;
  };
  coherence: {
    lastRecordedHenCount: number | null;
    computedHeadcount: number;
    isCoherent: boolean;
  };
}
