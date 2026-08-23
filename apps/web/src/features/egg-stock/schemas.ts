import { z } from 'zod';
import { MANUAL_EGG_STOCK_MOVEMENT_TYPES } from '@dondy-elevage/shared-types';

// Miroir de CreateEggStockMovementDto — SORTIE_VENTE/ENTREE_ANNULATION
// sont gérés exclusivement par le service de vente, absents des options
// (voir MANUAL_EGG_STOCK_MOVEMENT_TYPES).
export const createEggStockMovementSchema = z.object({
  lotId: z.string().min(1, 'Lot requis'),
  type: z.enum(MANUAL_EGG_STOCK_MOVEMENT_TYPES),
  quantity: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  date: z.string().min(1, 'Date requise'),
  reason: z.string().max(1000).optional().or(z.literal('')),
});
export type CreateEggStockMovementFormInput = z.input<typeof createEggStockMovementSchema>;
export type CreateEggStockMovementFormValues = z.output<typeof createEggStockMovementSchema>;
