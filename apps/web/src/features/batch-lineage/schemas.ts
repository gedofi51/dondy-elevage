import { z } from 'zod';

export const transformationTypeOptions = ['CHAIR', 'RENOUVELLEMENT', 'VENTE', 'REFORME_PERTE'] as const;

// Champs communs à toutes les destinations, plus les 3 champs conditionnels
// (buildingId/primaryManagerId/reason) — validés conditionnellement via
// superRefine plutôt que par des schémas séparés par destination, pour que
// le formulaire reste un `useForm` unique (moins de recâblage entre
// destinations, cohérent avec le patron RHF+Zod établi). Miroir des
// @ValidateIf de CreateOrientationDto.
export const createOrientationSchema = z
  .object({
    transformationType: z.enum(transformationTypeOptions),
    quantity: z.coerce.number().int('Nombre entier').min(1, 'Doit être au moins 1'),
    buildingId: z.string().optional().or(z.literal('')),
    primaryManagerId: z.string().optional().or(z.literal('')),
    reason: z.string().max(1000).optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (
      (values.transformationType === 'CHAIR' || values.transformationType === 'RENOUVELLEMENT') &&
      !values.buildingId
    ) {
      ctx.addIssue({ code: 'custom', path: ['buildingId'], message: 'Bâtiment requis pour cette destination' });
    }
    if (values.transformationType === 'CHAIR' && !values.primaryManagerId) {
      ctx.addIssue({
        code: 'custom',
        path: ['primaryManagerId'],
        message: 'Responsable requis pour orienter vers une bande de chair',
      });
    }
    if (values.transformationType === 'REFORME_PERTE' && !values.reason) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Motif requis pour une réforme/perte' });
    }
  });
export type CreateOrientationFormInput = z.input<typeof createOrientationSchema>;
export type CreateOrientationFormValues = z.output<typeof createOrientationSchema>;

/** Extrait de la logique de validation ci-dessus, réutilisée pour le rendu
 * conditionnel des champs (OrientationForm) — une seule source de vérité
 * pour "quels champs sont pertinents pour cette destination", testée
 * isolément (voir schemas.test.ts). */
export function getOrientationVisibleFields(
  transformationType: (typeof transformationTypeOptions)[number],
): { buildingId: boolean; primaryManagerId: boolean; reason: boolean } {
  return {
    buildingId: transformationType === 'CHAIR' || transformationType === 'RENOUVELLEMENT',
    primaryManagerId: transformationType === 'CHAIR',
    reason: transformationType === 'REFORME_PERTE',
  };
}
