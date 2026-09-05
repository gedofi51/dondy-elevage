import { z } from 'zod';

// Référentiel simple, miroir de CreateBuildingDto — mêmes champs en
// création et édition (même patron que incubatorBaseFields).
const buildingBaseFields = {
  name: z.string().min(1, 'Nom requis').max(191),
  type: z.string().min(1, 'Type requis').max(64),
  capacity: z.coerce.number().int('Nombre entier').positive().optional(),
};

export const createBuildingSchema = z.object(buildingBaseFields);
export type CreateBuildingFormInput = z.input<typeof createBuildingSchema>;
export type CreateBuildingFormValues = z.output<typeof createBuildingSchema>;

export const updateBuildingSchema = z.object(buildingBaseFields);
export type UpdateBuildingFormInput = z.input<typeof updateBuildingSchema>;
export type UpdateBuildingFormValues = z.output<typeof updateBuildingSchema>;

/** Types de bâtiment — texte libre côté API (pas d'enum Prisma), mais une
 * liste suggérée évite la dispersion des saisies (ex. "poulailler" vs
 * "Poulailler" vs "hangar poulets") — même esprit que les catégories
 * libres de Supplier/BroilerBatch.breed, ici bornées à ce que le cahier
 * mentionne réellement (poulaillers, couvoir, eau, solaire,
 * infrastructure — §8 V6) plus un type générique de repli. */
export const buildingTypeOptions: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'poulailler', label: 'Poulailler' },
  { value: 'couvoir', label: 'Couvoir' },
  { value: 'stockage', label: 'Stockage' },
  { value: 'administratif', label: 'Administratif' },
  { value: 'autre', label: 'Autre' },
];
