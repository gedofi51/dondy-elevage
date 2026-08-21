import { z } from 'zod';

export const waterPointStatusOptions = ['ACTIF', 'SUSPENDU', 'MAINTENANCE'] as const;

export const createWaterPointSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(191),
  location: z.string().max(191).optional().or(z.literal('')),
  meterReference: z.string().max(191).optional().or(z.literal('')),
  initialIndex: z.coerce.number().min(0, 'Doit être positif'),
  tariffFcfaPerM3: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
  responsibleId: z.string().min(1, 'Responsable requis'),
});
export type CreateWaterPointFormInput = z.input<typeof createWaterPointSchema>;
export type CreateWaterPointFormValues = z.output<typeof createWaterPointSchema>;

export const updateWaterPointSchema = createWaterPointSchema
  .omit({ initialIndex: true })
  .extend({ status: z.enum(waterPointStatusOptions) });
export type UpdateWaterPointFormInput = z.input<typeof updateWaterPointSchema>;
export type UpdateWaterPointFormValues = z.output<typeof updateWaterPointSchema>;

// Miroir de la logique conditionnelle de CreateWaterReadingDto (§7.3) :
// indexSoir < indexMatin (anomalie) exige consumptionM3 + une raison. Le
// calcul de l'écart caisse/théorique reste seul autoritaire côté API —
// jamais recalculé ici, surfacé comme erreur serveur (409) si besoin.
export const createWaterReadingSchema = z
  .object({
    date: z.string().min(1, 'Date requise'),
    indexMatin: z.coerce.number().min(0, 'Doit être positif'),
    indexSoir: z.coerce.number().min(0, 'Doit être positif'),
    consumptionM3: z.coerce.number().min(0).optional(),
    indexAnomalyReason: z.string().max(1000).optional().or(z.literal('')),
    cashAmountFcfa: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
    remarks: z.string().max(1000).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.indexSoir < data.indexMatin) {
      if (data.consumptionM3 === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['consumptionM3'],
          message: 'Requis quand le relevé du soir est inférieur à celui du matin (anomalie).',
        });
      }
      if (!data.indexAnomalyReason) {
        ctx.addIssue({
          code: 'custom',
          path: ['indexAnomalyReason'],
          message: 'Raison requise pour justifier cette anomalie.',
        });
      }
    }
  });
export type CreateWaterReadingFormInput = z.input<typeof createWaterReadingSchema>;
export type CreateWaterReadingFormValues = z.output<typeof createWaterReadingSchema>;
