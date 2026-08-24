import { z } from 'zod';

// buildingId uniquement — status volontairement absent (voir
// UpdateChickBatchInput, shared-types).
export const updateChickBatchSchema = z.object({
  buildingId: z.string().min(1, 'Bâtiment requis'),
});
export type UpdateChickBatchFormInput = z.input<typeof updateChickBatchSchema>;
export type UpdateChickBatchFormValues = z.output<typeof updateChickBatchSchema>;
