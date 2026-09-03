import { z } from 'zod';
import { INCUBATION_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import { performanceCoefficientWeightSchema } from '@/features/performance-score/schemas';

// Miroir de CreateIncubationBatchDto (§6.3) — breederBatchId/eggCount ne
// sont pas modifiables après création (filiation et quantité figées),
// donc absents du schéma d'édition ci-dessous.
export const createIncubationBatchSchema = z.object({
  breederBatchId: z.string().min(1, 'Lot reproducteur requis'),
  incubatorId: z.string().min(1, 'Couveuse requise'),
  incubationStartDate: z.string().min(1, 'Date requise'),
  eggCount: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  remarks: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateIncubationBatchFormInput = z.input<typeof createIncubationBatchSchema>;
export type CreateIncubationBatchFormValues = z.output<typeof createIncubationBatchSchema>;

// UpdateIncubationBatchDto est un DTO plat unique côté API (pas d'endpoint
// séparé pour le bilan de mirage/éclosion) — un seul formulaire, deux
// groupes visuels ("Suivi couveuse" / "Bilan mirage-éclosion"), voir
// plan Phase 13 section E (corrigé après challenge : pas de scission en
// deux routes/schémas).
export const updateIncubationBatchSchema = z.object({
  incubatorId: z.string().min(1, 'Couveuse requise'),
  incubationStartDate: z.string().min(1, 'Date requise'),
  remarks: z.string().max(2000).optional().or(z.literal('')),
  status: z.enum(INCUBATION_BATCH_EDITABLE_STATUSES),
  actualHatchDate: z.string().optional().or(z.literal('')),
  eggsInfertile: z.coerce.number().int('Nombre entier').min(0).optional(),
  eggsInfected: z.coerce.number().int('Nombre entier').min(0).optional(),
  embryonicMortality: z.coerce.number().int('Nombre entier').min(0).optional(),
  chicksHatched: z.coerce.number().int('Nombre entier').min(0).optional(),
});
export type UpdateIncubationBatchFormInput = z.input<typeof updateIncubationBatchSchema>;
export type UpdateIncubationBatchFormValues = z.output<typeof updateIncubationBatchSchema>;

// Score de performance (Lot 5) — pas de cible (éclosion/fécondité sont déjà
// des taux 0-100 naturels), voir features/performance-score/schemas.ts.
export const incubationPerformanceCoefficientsSchema = z.object({
  hatchRateWeight: performanceCoefficientWeightSchema,
  fertilityRateWeight: performanceCoefficientWeightSchema,
});
export type IncubationPerformanceCoefficientsFormInput = z.input<
  typeof incubationPerformanceCoefficientsSchema
>;
export type IncubationPerformanceCoefficientsFormValues = z.output<
  typeof incubationPerformanceCoefficientsSchema
>;
