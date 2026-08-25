export type AssetStatus = 'ACTIF' | 'HORS_SERVICE' | 'REFORME';

export type DepreciationMethod = 'LINEAIRE';

/** REFORME est un statut terminal, jamais atteignable via PATCH générique —
 * seul POST /assets/:id/reformer y mène (voir DETTE_TECHNIQUE.md Phase 16,
 * leçon tirée de la dette transversale "statuts terminaux non protégés"). */
export const ASSET_EDITABLE_STATUSES = ['ACTIF', 'HORS_SERVICE'] as const;

export interface Asset {
  id: string;
  farmId: string;
  code: string;
  designation: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  supplierId: string | null;
  purchaseDate: string;
  serviceDate: string;
  purchasePriceFcfa: number;
  installationCostFcfa: number;
  location: string | null;
  responsibleId: string;
  status: AssetStatus;
  warrantyExpiresAt: string | null;
  residualValueFcfa: number;
  depreciationMethod: DepreciationMethod;
  depreciationDurationYears: number;
  reformDate: string | null;
  reformReason: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** `accumulatedDepreciationFcfa`/`netBookValueFcfa` : dérivés à la lecture
 * depuis la dernière DepreciationEntry dont periodEnd <= aujourd'hui (ou
 * <= reformDate si l'actif est réformé) — jamais recalculés indépendamment
 * du plan déjà généré. `tcoFcfa` : coût total de possession partiel cette
 * phase (Maintenance, Phase 17, n'existe pas encore) — voir
 * DETTE_TECHNIQUE.md. */
export interface AssetWithComputed extends Asset {
  totalAcquisitionCostFcfa: number;
  accumulatedDepreciationFcfa: number;
  netBookValueFcfa: number;
  tcoFcfa: number;
}

export interface CreateAssetInput {
  designation: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  supplierId?: string;
  purchaseDate: string;
  serviceDate: string;
  purchasePriceFcfa: number;
  installationCostFcfa?: number;
  location?: string;
  responsibleId: string;
  warrantyExpiresAt?: string;
  residualValueFcfa?: number;
  depreciationDurationYears: number;
  observations?: string;
}

/** Les paramètres qui définissent le plan d'amortissement déjà généré
 * (purchaseDate/serviceDate/purchasePriceFcfa/installationCostFcfa/
 * residualValueFcfa/depreciationDurationYears) sont volontairement absents
 * — immuables après création (même discipline que
 * currentStock/averageUnitCostFcfa sur Item, écrits par un seul point
 * d'entrée). Une erreur de saisie se corrige par suppression (voir garde
 * de AssetsService.remove()) + recréation, pas par correction en place. */
export interface UpdateAssetInput {
  designation?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  supplierId?: string;
  location?: string;
  responsibleId?: string;
  status?: (typeof ASSET_EDITABLE_STATUSES)[number];
  warrantyExpiresAt?: string;
  observations?: string;
}

export interface ReformAssetInput {
  reformDate?: string;
  reformReason?: string;
}
