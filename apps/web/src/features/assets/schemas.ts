import { z } from 'zod';
import { ASSET_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';

/** 10 valeurs canoniques du cahier V6 §3 — Select strict (pas de texte
 * libre) pour éliminer à la source le risque de faute de frappe qui
 * casserait silencieusement la correspondance catégorie→onglet
 * Infrastructure (voir DETTE_TECHNIQUE.md Phase 19, décision D1). Valeurs
 * stockées en minuscules sans accent, correspondance triviale avec la
 * normalisation utilisée côté onglets. */
export const assetCategoryOptions = [
  'elevage',
  'batiments',
  'eau',
  'solaire',
  'internet',
  'transport',
  'froid',
  'informatique',
  'securite',
  'outillage',
] as const;
export type AssetCategory = (typeof assetCategoryOptions)[number];

export const assetCategoryLabels: Record<AssetCategory, string> = {
  elevage: 'Élevage',
  batiments: 'Bâtiments',
  eau: 'Eau',
  solaire: 'Solaire',
  internet: 'Internet',
  transport: 'Transport',
  froid: 'Froid',
  informatique: 'Informatique',
  securite: 'Sécurité',
  outillage: 'Outillage',
};

// Base commune création/édition — miroir de CreateAssetDto (§3.1).
const assetBaseFields = {
  designation: z.string().min(1, 'Désignation requise').max(191),
  category: z.enum(assetCategoryOptions),
  brand: z.string().max(191).optional().or(z.literal('')),
  model: z.string().max(191).optional().or(z.literal('')),
  serialNumber: z.string().max(191).optional().or(z.literal('')),
  supplierId: z.string().optional().or(z.literal('')),
  location: z.string().max(191).optional().or(z.literal('')),
  responsibleId: z.string().min(1, 'Responsable requis'),
  warrantyExpiresAt: z.string().optional().or(z.literal('')),
  observations: z.string().max(2000).optional().or(z.literal('')),
};

// purchaseDate/serviceDate/purchasePriceFcfa/installationCostFcfa/
// residualValueFcfa/depreciationDurationYears : immuables après création
// (UpdateAssetInput ne les accepte pas), donc uniquement dans le schéma de
// création, jamais dans celui d'édition.
export const createAssetSchema = z.object({
  ...assetBaseFields,
  purchaseDate: z.string().min(1, 'Date d’achat requise'),
  serviceDate: z.string().min(1, 'Date de mise en service requise'),
  purchasePriceFcfa: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
  installationCostFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  residualValueFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  depreciationDurationYears: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
});
export type CreateAssetFormInput = z.input<typeof createAssetSchema>;
export type CreateAssetFormValues = z.output<typeof createAssetSchema>;

// status restreint aux 2 valeurs "libres" — REFORME passe exclusivement par
// POST /:id/reformer (voir DETTE_TECHNIQUE.md Phase 16, le backend ne garde
// cette restriction que via @IsIn, le frontend est le second garde-fou).
export const updateAssetSchema = z.object({
  ...assetBaseFields,
  status: z.enum(ASSET_EDITABLE_STATUSES),
});
export type UpdateAssetFormInput = z.input<typeof updateAssetSchema>;
export type UpdateAssetFormValues = z.output<typeof updateAssetSchema>;

export const reformAssetSchema = z.object({
  reformDate: z.string().optional().or(z.literal('')),
  reformReason: z.string().max(1000).optional().or(z.literal('')),
});
export type ReformAssetFormInput = z.input<typeof reformAssetSchema>;
export type ReformAssetFormValues = z.output<typeof reformAssetSchema>;
