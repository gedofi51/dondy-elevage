export type BroilerOrigin = 'ACHAT' | 'NAISSANCE_INTERNE';

export type BroilerBatchStatus =
  | 'BROUILLON'
  | 'PLANIFIEE'
  | 'EN_DEMARRAGE'
  | 'EN_CROISSANCE'
  | 'EN_FINITION'
  | 'PRETE_A_VENDRE'
  | 'EN_VENTE'
  | 'VENDUE'
  | 'CLOTUREE'
  | 'ANNULEE';

/** Les 8 premières valeurs sont modifiables librement par PATCH ;
 * ANNULEE/CLOTUREE ne devraient passer que par les endpoints dédiés
 * (/annuler, /cloturer) — convention documentée côté API mais non
 * appliquée par UpdateBroilerBatchDto/service (dette backend, voir
 * DETTE_TECHNIQUE.md Phase 11). Le formulaire de modification n'affiche
 * donc que ce sous-ensemble, pas l'union complète. */
export const BROILER_BATCH_EDITABLE_STATUSES = [
  'BROUILLON',
  'PLANIFIEE',
  'EN_DEMARRAGE',
  'EN_CROISSANCE',
  'EN_FINITION',
  'PRETE_A_VENDRE',
  'EN_VENTE',
  'VENDUE',
] as const satisfies readonly BroilerBatchStatus[];

export type MortalityCause =
  | 'INCONNUE'
  | 'MALADIE'
  | 'ACCIDENT'
  | 'ETOUFFEMENT'
  | 'CHALEUR'
  | 'FROID'
  | 'PROBLEME_ALIMENTAIRE'
  | 'PROBLEME_EAU'
  | 'PREDATEUR'
  | 'AUTRE';

export type HealthEventType =
  | 'VACCINATION'
  | 'TRAITEMENT'
  | 'PROPHYLAXIE'
  | 'DESINFECTION'
  | 'VITAMINE'
  | 'CONSULTATION_VETERINAIRE';

export type HealthEventStatus = 'PREVU' | 'REALISE' | 'REPORTE' | 'ANNULE';

export type HealthEventRoute = 'EAU' | 'INJECTION' | 'AUTRE';

export interface BroilerBatch {
  id: string;
  farmId: string;
  code: string;
  breed: string | null;
  arrivalDate: string;
  arrivalTime: string | null;
  origin: BroilerOrigin;
  supplierId: string | null;
  invoiceNumber: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  deadOnArrivalQuantity: number;
  unitPriceFcfa: number;
  transportCostFcfa: number;
  otherCostsFcfa: number;
  buildingId: string;
  primaryManagerId: string;
  plannedSaleDate: string;
  status: BroilerBatchStatus;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** Champs calculés côté service (jamais recalculés côté client — voir
 * principe directeur CLAUDE.md), attachés à chaque lecture. */
export interface BroilerBatchWithComputed extends BroilerBatch {
  startedQuantity: number;
  chickCostFcfa: number;
  totalAcquisitionCostFcfa: number;
  currentHeadcount: number;
}

export interface CreateBroilerBatchInput {
  arrivalDate: string;
  arrivalTime?: string;
  breed?: string;
  origin: BroilerOrigin;
  /** Requis si origin=ACHAT (vérifié côté service). */
  supplierId?: string;
  invoiceNumber?: string;
  orderedQuantity: number;
  receivedQuantity: number;
  deadOnArrivalQuantity?: number;
  unitPriceFcfa: number;
  transportCostFcfa?: number;
  otherCostsFcfa?: number;
  buildingId: string;
  primaryManagerId: string;
  /** Défaut serveur = arrivalDate + 44 jours si omis. */
  plannedSaleDate?: string;
  observations?: string;
}

export interface UpdateBroilerBatchInput {
  arrivalDate?: string;
  arrivalTime?: string;
  breed?: string;
  origin?: BroilerOrigin;
  supplierId?: string;
  invoiceNumber?: string;
  orderedQuantity?: number;
  receivedQuantity?: number;
  deadOnArrivalQuantity?: number;
  unitPriceFcfa?: number;
  transportCostFcfa?: number;
  otherCostsFcfa?: number;
  buildingId?: string;
  primaryManagerId?: string;
  plannedSaleDate?: string;
  status?: BroilerBatchStatus;
  observations?: string;
}

/** dayNumber/date en lecture seule (générés à la création de la bande) —
 * un BroilerDailyRecord n'est jamais créé/supprimé côté frontend, GET/PATCH
 * uniquement. operatorId=null signale une journée non saisie. Champs
 * Decimal Prisma sérialisés en string (voir WaterPoint.initialIndex). */
export interface BroilerDailyRecord {
  id: string;
  farmId: string;
  batchId: string;
  dayNumber: number;
  date: string;
  operatorId: string | null;
  entryTime: string | null;
  mortalityQuantity: number;
  cullsQuantity: number;
  otherExitsQuantity: number;
  feedType: string | null;
  feedDistributedKg: string | null;
  feedRemainingKg: string | null;
  feedBagsUsed: number | null;
  /** null explicite déclenche un retour de stock côté serveur si un item
   * était précédemment renseigné — mapper ''→null à la soumission, jamais
   * omettre le champ (voir schemas.ts). */
  feedItemId: string | null;
  waterConsumptionLiters: string | null;
  waterObservation: string | null;
  sampleSize: number | null;
  totalSampleWeightG: number | null;
  averageWeightG: number | null;
  temperatureMinC: string | null;
  temperatureMaxC: string | null;
  temperatureNowC: string | null;
  humidityPercent: string | null;
  symptoms: string | null;
  treatment: string | null;
  vaccination: string | null;
  healthProduct: string | null;
  healthQuantity: string | null;
  healthResponsible: string | null;
  behaviorNormal: boolean;
  behaviorLowConsumption: boolean;
  behaviorAgitation: boolean;
  behaviorFlocking: boolean;
  behaviorLethargy: boolean;
  behaviorDiarrhea: boolean;
  behaviorRespiratoryDistress: boolean;
  behaviorOther: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDailyRecordInput {
  entryTime?: string;
  mortalityQuantity?: number;
  cullsQuantity?: number;
  otherExitsQuantity?: number;
  feedType?: string;
  feedDistributedKg?: number;
  feedRemainingKg?: number;
  feedBagsUsed?: number;
  /** `null` déclenche un retour de stock si un item était renseigné avant. */
  feedItemId?: string | null;
  waterConsumptionLiters?: number;
  waterObservation?: string;
  sampleSize?: number;
  totalSampleWeightG?: number;
  temperatureMinC?: number;
  temperatureMaxC?: number;
  temperatureNowC?: number;
  humidityPercent?: number;
  symptoms?: string;
  treatment?: string;
  vaccination?: string;
  healthProduct?: string;
  healthQuantity?: string;
  healthResponsible?: string;
  behaviorNormal?: boolean;
  behaviorLowConsumption?: boolean;
  behaviorAgitation?: boolean;
  behaviorFlocking?: boolean;
  behaviorLethargy?: boolean;
  behaviorDiarrhea?: boolean;
  behaviorRespiratoryDistress?: boolean;
  behaviorOther?: string;
  observations?: string;
}

export interface BroilerMortality {
  id: string;
  farmId: string;
  batchId: string;
  date: string;
  dayNumber: number;
  quantity: number;
  cause: MortalityCause;
  observation: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMortalityInput {
  date: string;
  dayNumber: number;
  quantity: number;
  cause?: MortalityCause;
  observation?: string;
}

export interface BroilerHealthEvent {
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
  /** itemId renseigné + status=REALISE déclenche un mouvement de stock. */
  itemId: string | null;
  quantityUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHealthEventInput {
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

/** Renvoyé par GET /:id/profitability (lecture pure, à tout moment) ET par
 * la réponse de POST /:id/cloturer (même forme) — un seul type pour les
 * deux usages. */
export interface BatchClosureSummary {
  production: {
    receivedQuantity: number;
    startedQuantity: number;
    cumulativeMortality: number;
    soldCount: number;
    cycleDurationDays: number;
  };
  performance: {
    cumulativeMortalityRate: number;
    finalAverageWeightG: number | null;
    totalFeedConsumptionKg: number;
    feedConversionRatio: number;
  };
  finances: {
    totalExpensesFcfa: number;
    revenueFcfa: number;
    grossMarginFcfa: number;
    profitabilityRate: number;
    costPerChickProducedFcfa: number;
    costPerChickSoldFcfa: number;
  };
  coherence: {
    dailyRecordMortalityTotal: number;
    detailedMortalityTotal: number;
    isCoherent: boolean;
  };
}
