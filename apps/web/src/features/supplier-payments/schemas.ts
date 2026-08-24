import { z } from 'zod';

export const createSupplierPaymentSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  method: z.string().min(1, 'Mode de paiement requis').max(191),
  amountFcfa: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
  reference: z.string().max(191).optional().or(z.literal('')),
  observation: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateSupplierPaymentFormInput = z.input<typeof createSupplierPaymentSchema>;
export type CreateSupplierPaymentFormValues = z.output<typeof createSupplierPaymentSchema>;
