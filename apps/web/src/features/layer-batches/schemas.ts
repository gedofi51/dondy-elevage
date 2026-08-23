import { z } from 'zod';
import { LAYER_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';
import {
  healthEventRouteOptions,
  healthEventStatusOptions,
  healthEventTypeOptions,
} from '@/features/broiler-batches/schemas';

// Base commune création/édition — miroir de CreateLayerBatchDto (§5.1). Le
// formulaire d'édition suit le même patron que WaterPointForm/BroilerBatchForm
// : un formulaire "plein" pré-rempli depuis l'existant, pas un PATCH partiel
// depuis l'UI (même si l'API accepte un partiel).
const layerBatchBaseFields = {
  entryDate: z.string().min(1, 'Date requise'),
  strain: z.string().max(191).optional().or(z.literal('')),
  initialQuantity: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  ageAtEntryWeeks: z.coerce.number().int('Nombre entier').min(0).optional(),
  ageAtEntryDays: z.coerce.number().int('Nombre entier').min(0).optional(),
  buildingId: z.string().min(1, 'Bâtiment requis'),
  primaryManagerId: z.string().min(1, 'Responsable requis'),
  observations: z.string().max(2000).optional().or(z.literal('')),
};

export const createLayerBatchSchema = z.object(layerBatchBaseFields);
export type CreateLayerBatchFormInput = z.input<typeof createLayerBatchSchema>;
export type CreateLayerBatchFormValues = z.output<typeof createLayerBatchSchema>;

// Statut restreint aux 3 valeurs "libres" — CLOTURE/ANNULEE passent
// exclusivement par les endpoints dédiés (/cloturer, /annuler), voir
// DETTE_TECHNIQUE.md (le backend ne garde pas cette restriction, donc le
// frontend est le seul garde-fou réel ici).
export const updateLayerBatchSchema = z.object({
  ...layerBatchBaseFields,
  status: z.enum(LAYER_BATCH_EDITABLE_STATUSES),
});
export type UpdateLayerBatchFormInput = z.input<typeof updateLayerBatchSchema>;
export type UpdateLayerBatchFormValues = z.output<typeof updateLayerBatchSchema>;

// Champs communs création/édition d'une journée de ponte — seul eggsLaid
// change de caractère requis entre les deux (requis à la création, comme
// CreateDailyRecordDto ; optionnel en édition, comme UpdateDailyRecordDto).
// Pas de `date` ici : gérée séparément par la route (immuable en édition).
const layerDailyRecordSharedFields = {
  feedItemId: z.string().optional().or(z.literal('')),
  henCount: z.coerce.number().int('Nombre entier').min(0).optional(),
  mortalityQuantity: z.coerce.number().int('Nombre entier').min(0).optional(),
  cullsQuantity: z.coerce.number().int('Nombre entier').min(0).optional(),
  otherExitsQuantity: z.coerce.number().int('Nombre entier').min(0).optional(),
  eggsBroken: z.coerce.number().int('Nombre entier').min(0).optional(),
  eggsRejected: z.coerce.number().int('Nombre entier').min(0).optional(),
  feedDistributedKg: z.coerce.number().min(0).optional(),
  observations: z.string().max(2000).optional().or(z.literal('')),
};

export const createLayerDailyRecordSchema = z.object({
  ...layerDailyRecordSharedFields,
  eggsLaid: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
});
export type CreateLayerDailyRecordFormInput = z.input<typeof createLayerDailyRecordSchema>;
export type CreateLayerDailyRecordFormValues = z.output<typeof createLayerDailyRecordSchema>;

export const updateLayerDailyRecordSchema = z.object({
  ...layerDailyRecordSharedFields,
  eggsLaid: z.coerce.number().int('Nombre entier').min(0).optional(),
});
export type UpdateLayerDailyRecordFormInput = z.input<typeof updateLayerDailyRecordSchema>;
export type UpdateLayerDailyRecordFormValues = z.output<typeof updateLayerDailyRecordSchema>;

// LayerHealthEvent est un duplicata strict de BroilerHealthEvent côté
// backend — mêmes enums, réutilisés tels quels depuis broiler-batches
// (voir plan Phase 12, section H) plutôt que redéfinis ici.
export const createLayerHealthEventSchema = z.object({
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
export type CreateLayerHealthEventFormInput = z.input<typeof createLayerHealthEventSchema>;
export type CreateLayerHealthEventFormValues = z.output<typeof createLayerHealthEventSchema>;
