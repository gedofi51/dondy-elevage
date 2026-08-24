import { z } from 'zod';

/** 8 catégories canoniques du cahier des charges (docs/reference/STOCKS.md)
 * — le champ reste un texte libre côté API (aucun enum), mais suggéré via
 * <datalist> pour éviter la dérive de casse déjà trouvée entre le code
 * existant ('aliments', Chair/Pondeuses) et les fixtures e2e backend
 * ('Alimentation', non normatif) — voir DETTE_TECHNIQUE.md Phase 14. */
export const ITEM_CANONICAL_CATEGORIES = [
  'aliments',
  'médicaments',
  'vaccins',
  'désinfectants',
  'litière',
  'équipements',
  'carburant',
  'consommables',
] as const;

const itemBaseFields = {
  name: z.string().min(1, 'Nom requis').max(191),
  category: z.string().min(1, 'Catégorie requise').max(191),
  unit: z.string().min(1, 'Unité requise').max(191),
  minThreshold: z.coerce.number().min(0).optional(),
  supplierId: z.string().optional().or(z.literal('')),
};

export const createItemSchema = z.object(itemBaseFields);
export type CreateItemFormInput = z.input<typeof createItemSchema>;
export type CreateItemFormValues = z.output<typeof createItemSchema>;

export const updateItemSchema = z.object(itemBaseFields);
export type UpdateItemFormInput = z.input<typeof updateItemSchema>;
export type UpdateItemFormValues = z.output<typeof updateItemSchema>;
