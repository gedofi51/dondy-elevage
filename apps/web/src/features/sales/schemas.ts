import { z } from 'zod';

export const saleModeOptions = ['UNITE', 'POIDS', 'LOT'] as const;

export const createSaleSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  customerId: z.string().optional(),
  saleMode: z.enum(saleModeOptions),
  quantity: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  unitPriceFcfa: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
  discountFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  observation: z.string().max(1000).optional().or(z.literal('')),
});
export type CreateSaleFormInput = z.input<typeof createSaleSchema>;
export type CreateSaleFormValues = z.output<typeof createSaleSchema>;
