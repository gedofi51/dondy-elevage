import { z } from 'zod';
import { MAINTENANCE_TASK_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';

export const maintenanceTaskManualTypeOptions = ['CORRECTIVE', 'CONDITIONNELLE'] as const;

export const createMaintenancePlanSchema = z.object({
  designation: z.string().min(1, 'Désignation requise').max(191),
  periodicityDays: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  startDate: z.string().min(1, 'Date de départ requise'),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateMaintenancePlanFormInput = z.input<typeof createMaintenancePlanSchema>;
export type CreateMaintenancePlanFormValues = z.output<typeof createMaintenancePlanSchema>;

export const createMaintenanceTaskSchema = z.object({
  type: z.enum(maintenanceTaskManualTypeOptions),
  designation: z.string().min(1, 'Désignation requise').max(191),
  dueDate: z.string().min(1, 'Échéance requise'),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateMaintenanceTaskFormInput = z.input<typeof createMaintenanceTaskSchema>;
export type CreateMaintenanceTaskFormValues = z.output<typeof createMaintenanceTaskSchema>;

// status restreint aux 2 valeurs "libres" — REALISEE/ANNULEE passent
// exclusivement par la création d'intervention / POST /:id/annuler (voir
// DETTE_TECHNIQUE.md Phase 17).
export const updateMaintenanceTaskSchema = z.object({
  designation: z.string().min(1, 'Désignation requise').max(191),
  dueDate: z.string().min(1, 'Échéance requise'),
  status: z.enum(MAINTENANCE_TASK_EDITABLE_STATUSES),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type UpdateMaintenanceTaskFormInput = z.input<typeof updateMaintenanceTaskSchema>;
export type UpdateMaintenanceTaskFormValues = z.output<typeof updateMaintenanceTaskSchema>;

export const cancelMaintenanceTaskSchema = z.object({
  cancelReason: z.string().max(1000).optional().or(z.literal('')),
});
export type CancelMaintenanceTaskFormInput = z.input<typeof cancelMaintenanceTaskSchema>;
export type CancelMaintenanceTaskFormValues = z.output<typeof cancelMaintenanceTaskSchema>;

// itemId/quantity des pièces : useFieldArray, une ligne vide au départ
// (mirroring purchase-order-form.tsx).
export const createMaintenanceInterventionSchema = z.object({
  interventionDate: z.string().min(1, 'Date requise'),
  diagnosis: z.string().max(2000).optional().or(z.literal('')),
  laborCostFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  performedBy: z.string().max(191).optional().or(z.literal('')),
  parts: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Article requis'),
        quantity: z.coerce.number().min(0.001, 'Doit être positif'),
      }),
    )
    .optional(),
});
export type CreateMaintenanceInterventionFormInput = z.input<
  typeof createMaintenanceInterventionSchema
>;
export type CreateMaintenanceInterventionFormValues = z.output<
  typeof createMaintenanceInterventionSchema
>;
