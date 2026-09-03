import { z } from 'zod';
import { BROILER_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import {
  performanceCoefficientTargetSchema,
  performanceCoefficientWeightSchema,
} from '@/features/performance-score/schemas';

export const broilerOriginOptions = ['ACHAT', 'NAISSANCE_INTERNE'] as const;
export const mortalityCauseOptions = [
  'INCONNUE',
  'MALADIE',
  'ACCIDENT',
  'ETOUFFEMENT',
  'CHALEUR',
  'FROID',
  'PROBLEME_ALIMENTAIRE',
  'PROBLEME_EAU',
  'PREDATEUR',
  'AUTRE',
] as const;
export const healthEventTypeOptions = [
  'VACCINATION',
  'TRAITEMENT',
  'PROPHYLAXIE',
  'DESINFECTION',
  'VITAMINE',
  'CONSULTATION_VETERINAIRE',
] as const;
export const healthEventStatusOptions = ['PREVU', 'REALISE', 'REPORTE', 'ANNULE'] as const;
export const healthEventRouteOptions = ['EAU', 'INJECTION', 'AUTRE'] as const;

// Base commune création/édition — miroir de CreateBroilerBatchDto (§4.2).
// Le formulaire d'édition suit le même patron que WaterPointForm : un
// formulaire "plein" pré-rempli depuis l'existant, pas un PATCH partiel
// depuis l'UI (même si l'API accepte un partiel).
const broilerBatchBaseFields = {
  arrivalDate: z.string().min(1, 'Date requise'),
  arrivalTime: z.string().max(20).optional().or(z.literal('')),
  breed: z.string().max(191).optional().or(z.literal('')),
  origin: z.enum(broilerOriginOptions),
  supplierId: z.string().optional().or(z.literal('')),
  invoiceNumber: z.string().max(191).optional().or(z.literal('')),
  orderedQuantity: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  receivedQuantity: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  deadOnArrivalQuantity: z.coerce.number().int('Nombre entier').min(0).optional(),
  unitPriceFcfa: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
  transportCostFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  otherCostsFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  buildingId: z.string().min(1, 'Bâtiment requis'),
  primaryManagerId: z.string().min(1, 'Responsable requis'),
  plannedSaleDate: z.string().optional().or(z.literal('')),
  observations: z.string().max(2000).optional().or(z.literal('')),
};

// supplierId requis si origin=ACHAT (règle vérifiée côté serveur, dupliquée
// ici uniquement pour un retour immédiat — le serveur reste seul
// autoritaire, 400 si contournée).
function requireSupplierIfAchat(
  data: { origin: (typeof broilerOriginOptions)[number]; supplierId?: string },
  ctx: z.RefinementCtx,
) {
  if (data.origin === 'ACHAT' && !data.supplierId) {
    ctx.addIssue({
      code: 'custom',
      path: ['supplierId'],
      message: "Fournisseur requis lorsque l'origine est Achat.",
    });
  }
}

export const createBroilerBatchSchema = z
  .object(broilerBatchBaseFields)
  .superRefine(requireSupplierIfAchat);
export type CreateBroilerBatchFormInput = z.input<typeof createBroilerBatchSchema>;
export type CreateBroilerBatchFormValues = z.output<typeof createBroilerBatchSchema>;

// Statut restreint aux 8 valeurs "libres" — ANNULEE/CLOTUREE passent
// exclusivement par les endpoints dédiés (/annuler, /cloturer), voir
// DETTE_TECHNIQUE.md Phase 11 (le backend ne garde pas cette restriction,
// donc le frontend est le seul garde-fou réel ici).
export const updateBroilerBatchSchema = z
  .object({ ...broilerBatchBaseFields, status: z.enum(BROILER_BATCH_EDITABLE_STATUSES) })
  .superRefine(requireSupplierIfAchat);
export type UpdateBroilerBatchFormInput = z.input<typeof updateBroilerBatchSchema>;
export type UpdateBroilerBatchFormValues = z.output<typeof updateBroilerBatchSchema>;

// Miroir d'UpdateDailyRecordDto — tous optionnels (PATCH partiel). feedItemId
// reste une string brute ici (uuid ou '') ; le mapping ''→null explicite
// attendu par l'API se fait à la soumission (voir daily-record-form.tsx),
// pas dans le schéma — un null Zod compliquerait le typage du Select sans
// bénéfice de validation supplémentaire.
export const updateDailyRecordSchema = z.object({
  entryTime: z.string().max(20).optional().or(z.literal('')),
  mortalityQuantity: z.coerce.number().int('Nombre entier').min(0).optional(),
  cullsQuantity: z.coerce.number().int('Nombre entier').min(0).optional(),
  otherExitsQuantity: z.coerce.number().int('Nombre entier').min(0).optional(),
  feedType: z.string().max(191).optional().or(z.literal('')),
  feedDistributedKg: z.coerce.number().min(0).optional(),
  feedRemainingKg: z.coerce.number().min(0).optional(),
  feedBagsUsed: z.coerce.number().int('Nombre entier').min(0).optional(),
  feedItemId: z.string().optional().or(z.literal('')),
  waterConsumptionLiters: z.coerce.number().min(0).optional(),
  waterObservation: z.string().max(1000).optional().or(z.literal('')),
  sampleSize: z.coerce.number().int('Nombre entier').min(0).optional(),
  totalSampleWeightG: z.coerce.number().int('Nombre entier').min(0).optional(),
  temperatureMinC: z.coerce.number().optional(),
  temperatureMaxC: z.coerce.number().optional(),
  temperatureNowC: z.coerce.number().optional(),
  humidityPercent: z.coerce.number().min(0).max(100).optional(),
  symptoms: z.string().max(2000).optional().or(z.literal('')),
  treatment: z.string().max(2000).optional().or(z.literal('')),
  vaccination: z.string().max(191).optional().or(z.literal('')),
  healthProduct: z.string().max(191).optional().or(z.literal('')),
  healthQuantity: z.string().max(191).optional().or(z.literal('')),
  healthResponsible: z.string().max(191).optional().or(z.literal('')),
  behaviorNormal: z.boolean(),
  behaviorLowConsumption: z.boolean(),
  behaviorAgitation: z.boolean(),
  behaviorFlocking: z.boolean(),
  behaviorLethargy: z.boolean(),
  behaviorDiarrhea: z.boolean(),
  behaviorRespiratoryDistress: z.boolean(),
  behaviorOther: z.string().max(191).optional().or(z.literal('')),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type UpdateDailyRecordFormInput = z.input<typeof updateDailyRecordSchema>;
export type UpdateDailyRecordFormValues = z.output<typeof updateDailyRecordSchema>;

export const createMortalitySchema = z.object({
  date: z.string().min(1, 'Date requise'),
  dayNumber: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1').max(45),
  quantity: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  cause: z.enum(mortalityCauseOptions).optional(),
  observation: z.string().max(1000).optional().or(z.literal('')),
});
export type CreateMortalityFormInput = z.input<typeof createMortalitySchema>;
export type CreateMortalityFormValues = z.output<typeof createMortalitySchema>;

export const createHealthEventSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  type: z.enum(healthEventTypeOptions),
  itemId: z.string().optional().or(z.literal('')),
  quantityUsed: z.coerce.number().min(0).optional(),
  status: z.enum(healthEventStatusOptions).optional(),
  product: z.string().max(191).optional().or(z.literal('')),
  motif: z.string().max(1000).optional().or(z.literal('')),
  dose: z.string().max(191).optional().or(z.literal('')),
  quantity: z.string().max(191).optional().or(z.literal('')),
  unit: z.string().max(50).optional().or(z.literal('')),
  durationDays: z.coerce.number().int('Nombre entier').min(0).optional(),
  administrationRoute: z.enum(healthEventRouteOptions).optional(),
  prescribedBy: z.string().max(191).optional().or(z.literal('')),
  performedBy: z.string().max(191).optional().or(z.literal('')),
  costFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  observation: z.string().max(1000).optional().or(z.literal('')),
});
export type CreateHealthEventFormInput = z.input<typeof createHealthEventSchema>;
export type CreateHealthEventFormValues = z.output<typeof createHealthEventSchema>;

// Score de performance (Lot 5) — voir features/performance-score/schemas.ts
// pour les briques réutilisées (poids/cible).
export const broilerPerformanceCoefficientsSchema = z.object({
  mortalityWeight: performanceCoefficientWeightSchema,
  icWeight: performanceCoefficientWeightSchema,
  icTarget: performanceCoefficientTargetSchema,
  gmqWeight: performanceCoefficientWeightSchema,
  gmqTarget: performanceCoefficientTargetSchema,
});
export type BroilerPerformanceCoefficientsFormInput = z.input<
  typeof broilerPerformanceCoefficientsSchema
>;
export type BroilerPerformanceCoefficientsFormValues = z.output<
  typeof broilerPerformanceCoefficientsSchema
>;
