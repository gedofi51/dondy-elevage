import { z } from 'zod';
import { MANUAL_STOCK_MOVEMENT_REASONS } from '@dondy-elevage/shared-types';

export const manualStockMovementReasonOptions = MANUAL_STOCK_MOVEMENT_REASONS;

// `itemId` volontairement absent : connu du contexte (prop du composant,
// jamais un champ du formulaire) — StockMovementForm l'injecte directement
// dans le payload final, hors du schéma RHF/Zod (un champ requis mais
// jamais rempli par l'utilisateur aurait fait échouer la validation
// silencieusement, sans erreur visible puisqu'aucun champ ne lui est
// associé dans le JSX — trouvé en vérification manuelle).
// `type` reste un champ du formulaire (requis par le DTO dans tous les
// cas) — auto-rempli/masqué selon reason (voir reason-type.ts et
// StockMovementCreateDialog), visible seulement si reason=AJUSTEMENT.
// unitCostFcfa/justification validés conditionnellement via superRefine,
// miroir des @ValidateIf de CreateStockMovementDto.
export const createStockMovementSchema = z
  .object({
    type: z.enum(['ENTREE', 'SORTIE']),
    reason: z.enum(manualStockMovementReasonOptions),
    quantity: z.coerce.number().min(0.001, 'Doit être positif'),
    date: z.string().min(1, 'Date requise'),
    unitCostFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
    justification: z.string().optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (values.reason === 'PRODUCTION_INTERNE' && values.unitCostFcfa === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['unitCostFcfa'],
        message: 'Coût unitaire requis pour une production interne',
      });
    }
    if (values.reason === 'AJUSTEMENT' && !values.justification) {
      ctx.addIssue({
        code: 'custom',
        path: ['justification'],
        message: 'Justification requise pour un ajustement',
      });
    }
  });
export type CreateStockMovementFormInput = z.input<typeof createStockMovementSchema>;
export type CreateStockMovementFormValues = z.output<typeof createStockMovementSchema>;
