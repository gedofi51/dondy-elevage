export type WaterPointStatus = 'ACTIF' | 'SUSPENDU' | 'MAINTENANCE';

/** `initialIndex` est un `Decimal` Prisma côté API — sérialisé en chaîne
 * de caractères sur le fil JSON (comportement par défaut de decimal.js),
 * pas en nombre. Convertir explicitement côté UI avant tout calcul. */
export interface WaterPoint {
  id: string;
  farmId: string;
  code: string;
  name: string;
  location: string | null;
  meterReference: string | null;
  initialIndex: string;
  tariffFcfaPerM3: number;
  responsibleId: string;
  status: WaterPointStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateWaterPointInput {
  name: string;
  location?: string;
  meterReference?: string;
  initialIndex: number;
  tariffFcfaPerM3: number;
  responsibleId: string;
}

export interface UpdateWaterPointInput {
  name?: string;
  location?: string;
  meterReference?: string;
  initialIndex?: number;
  tariffFcfaPerM3?: number;
  responsibleId?: string;
  status?: WaterPointStatus;
}

/** `indexMatin`/`indexSoir`/`consumptionM3` sont des `Decimal` Prisma —
 * mêmes réserves de sérialisation que `WaterPoint.initialIndex`. */
export interface WaterReading {
  id: string;
  farmId: string;
  waterPointId: string;
  date: string;
  operatorId: string | null;
  indexMatin: string;
  indexSoir: string;
  consumptionM3: string;
  tariffFcfaPerM3Snapshot: number;
  theoreticalAmountFcfa: number;
  cashAmountFcfa: number;
  varianceFcfa: number;
  indexAnomalyReason: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateWaterReadingInput {
  date: string;
  indexMatin: number;
  indexSoir: number;
  /** Requis uniquement si indexSoir < indexMatin (anomalie documentée). */
  consumptionM3?: number;
  indexAnomalyReason?: string;
  cashAmountFcfa: number;
  /** Requis si l'écart théorique/encaissé calculé côté serveur est non
   * nul — non calculable côté client, laissé optionnel ici ; le serveur
   * renvoie un 409 explicite si manquant alors que requis. */
  remarks?: string;
}

export interface WaterPointKpiSummary {
  periodStart: string;
  periodEnd: string;
  totalConsumptionM3: number;
  totalTheoreticalAmountFcfa: number;
  totalCashAmountFcfa: number;
  totalVarianceFcfa: number;
  averageConsumptionM3: number;
  availabilityRatePercent: number;
  receivablesFcfa: number;
  totalExpensesFcfa: number;
  grossMarginFcfa: number;
  profitabilityRate: number;
}
