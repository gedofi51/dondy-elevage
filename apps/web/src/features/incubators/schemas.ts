import { z } from 'zod';

// Référentiel simple, miroir de CreateIncubatorDto — mêmes champs en
// création et édition, pas de statut à restreindre.
const incubatorBaseFields = {
  name: z.string().min(1, 'Nom requis').max(191),
  capacityEggs: z.coerce.number().int('Nombre entier').positive().optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
};

export const createIncubatorSchema = z.object(incubatorBaseFields);
export type CreateIncubatorFormInput = z.input<typeof createIncubatorSchema>;
export type CreateIncubatorFormValues = z.output<typeof createIncubatorSchema>;

export const updateIncubatorSchema = z.object(incubatorBaseFields);
export type UpdateIncubatorFormInput = z.input<typeof updateIncubatorSchema>;
export type UpdateIncubatorFormValues = z.output<typeof updateIncubatorSchema>;
