import { z } from 'zod';

// CRUD simple nom/code — même patron que incubatorBaseFields. buildingId
// est fourni séparément (pas dans le formulaire, jamais modifiable après
// création — voir UpdateBlockDto côté API).
const blockBaseFields = {
  name: z.string().min(1, 'Nom requis').max(191),
  code: z.string().max(64).optional().or(z.literal('')),
};

export const createBlockSchema = z.object(blockBaseFields);
export type CreateBlockFormInput = z.input<typeof createBlockSchema>;
export type CreateBlockFormValues = z.output<typeof createBlockSchema>;

export const updateBlockSchema = z.object(blockBaseFields);
export type UpdateBlockFormInput = z.input<typeof updateBlockSchema>;
export type UpdateBlockFormValues = z.output<typeof updateBlockSchema>;
