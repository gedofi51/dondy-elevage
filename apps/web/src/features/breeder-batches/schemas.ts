import { z } from 'zod';
import { BREEDER_BATCH_EDITABLE_STATUSES } from '@dondy-elevage/shared-types';

// Miroir de CreateBreederBatchDto (§6.1) — formulaire d'édition = formulaire
// plein pré-rempli, même patron que Layer/Broiler.
const breederBatchBaseFields = {
  strain: z.string().max(191).optional().or(z.literal('')),
  constitutionDate: z.string().min(1, 'Date requise'),
  femaleCount: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  maleCount: z.coerce.number().int('Nombre entier').min(0),
  buildingId: z.string().min(1, 'Bâtiment requis'),
  // Option A (Bâtiments/Blocs) — additif/facultatif, jamais requis.
  blockId: z.string().optional().or(z.literal('')),
  primaryManagerId: z.string().min(1, 'Responsable requis'),
  observations: z.string().max(2000).optional().or(z.literal('')),
};

export const createBreederBatchSchema = z.object(breederBatchBaseFields);
export type CreateBreederBatchFormInput = z.input<typeof createBreederBatchSchema>;
export type CreateBreederBatchFormValues = z.output<typeof createBreederBatchSchema>;

// Statut restreint aux 2 valeurs "libres" — CLOTURE/ANNULEE différées cette
// phase (voir DETTE_TECHNIQUE.md Phase 13).
export const updateBreederBatchSchema = z.object({
  ...breederBatchBaseFields,
  status: z.enum(BREEDER_BATCH_EDITABLE_STATUSES),
});
export type UpdateBreederBatchFormInput = z.input<typeof updateBreederBatchSchema>;
export type UpdateBreederBatchFormValues = z.output<typeof updateBreederBatchSchema>;

// Champs communs création/édition d'une journée de production — seul
// eggsLaid change de caractère requis (requis à la création, optionnel en
// édition), comme Layer. Pas de `date` ici : gérée par la route (immuable
// en édition).
const breederDailyRecordSharedFields = {
  eggsSelectedForIncubation: z.coerce.number().int('Nombre entier').min(0).optional(),
  eggsRejected: z.coerce.number().int('Nombre entier').min(0).optional(),
  eggsSold: z.coerce.number().int('Nombre entier').min(0).optional(),
  observations: z.string().max(2000).optional().or(z.literal('')),
};

export const createBreederDailyRecordSchema = z.object({
  ...breederDailyRecordSharedFields,
  eggsLaid: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
});
export type CreateBreederDailyRecordFormInput = z.input<typeof createBreederDailyRecordSchema>;
export type CreateBreederDailyRecordFormValues = z.output<typeof createBreederDailyRecordSchema>;

export const updateBreederDailyRecordSchema = z.object({
  ...breederDailyRecordSharedFields,
  eggsLaid: z.coerce.number().int('Nombre entier').min(0).optional(),
});
export type UpdateBreederDailyRecordFormInput = z.input<typeof updateBreederDailyRecordSchema>;
export type UpdateBreederDailyRecordFormValues = z.output<typeof updateBreederDailyRecordSchema>;
