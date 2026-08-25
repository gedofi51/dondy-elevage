export type NetworkOperationalStatus = 'OPERATIONNEL' | 'DEGRADE' | 'HORS_LIGNE';

/** Champs Decimal Prisma sérialisés en chaîne de caractères sur le fil
 * JSON (comportement par défaut de decimal.js) — mêmes réserves que
 * WaterPoint.initialIndex. Convertir explicitement côté consommateur
 * avant tout calcul. */
export interface WaterInfrastructureReading {
  id: string;
  farmId: string;
  assetId: string;
  date: string;
  pumpedVolumeM3: string | null;
  reservoirLevelPercent: string | null;
  pumpHoursCumulative: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** `soldVolumeM3`/`gapM3` : dérivés à la lecture (équation de contrôle
 * V6 §5 : "Eau produite = consommation ferme + eau vendue +
 * pertes/écarts"), jamais stockés. `gapM3` = null si pumpedVolumeM3
 * est absent (équation non calculable). */
export interface WaterInfrastructureReadingWithComputed extends WaterInfrastructureReading {
  soldVolumeM3: number;
  gapM3: number | null;
}

export interface CreateWaterInfrastructureReadingInput {
  date: string;
  pumpedVolumeM3?: number;
  reservoirLevelPercent?: number;
  pumpHoursCumulative?: number;
  farmInternalConsumptionM3?: number;
  observations?: string;
}

export interface UpdateWaterInfrastructureReadingInput {
  pumpedVolumeM3?: number;
  reservoirLevelPercent?: number;
  pumpHoursCumulative?: number;
  farmInternalConsumptionM3?: number;
  observations?: string;
}

export interface SolarInfrastructureReading {
  id: string;
  farmId: string;
  assetId: string;
  date: string;
  dailyProductionKwh: string | null;
  batteryChargePercent: string | null;
  instantaneousPowerKw: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateSolarInfrastructureReadingInput {
  date: string;
  dailyProductionKwh?: number;
  batteryChargePercent?: number;
  instantaneousPowerKw?: number;
  observations?: string;
}

export interface UpdateSolarInfrastructureReadingInput {
  dailyProductionKwh?: number;
  batteryChargePercent?: number;
  instantaneousPowerKw?: number;
  observations?: string;
}

export interface NetworkStatusReading {
  id: string;
  farmId: string;
  assetId: string;
  date: string;
  operationalStatus: NetworkOperationalStatus;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateNetworkStatusReadingInput {
  date: string;
  operationalStatus: NetworkOperationalStatus;
  observations?: string;
}

export interface UpdateNetworkStatusReadingInput {
  operationalStatus?: NetworkOperationalStatus;
  observations?: string;
}
