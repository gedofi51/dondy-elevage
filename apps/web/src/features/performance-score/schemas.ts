import { z } from 'zod';

/**
 * Score de performance (Lot 5) — briques Zod partagées entre les 3
 * formulaires d'administration des coefficients (Chair/Pondeuses/Couvoir,
 * voir chaque `features/<type>-batches/schemas.ts`). Un poids de
 * composante est un texte numérique obligatoire (pré-rempli, jamais vide à
 * l'affichage — voir chaque *-performance-coefficients-form.tsx) ; une
 * cible (GMQ/IC uniquement) est optionnelle — laissée vide, elle exclut la
 * composante du score plutôt que d'imposer une valeur, voir
 * DETTE_TECHNIQUE.md Lot 5.
 */
export const performanceCoefficientWeightSchema = z
  .string()
  .refine((value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0, {
    message: 'Doit être un nombre positif ou nul',
  })
  .transform((value) => Number(value));

export const performanceCoefficientTargetSchema = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) > 0), {
    message: 'Doit être un nombre strictement positif',
  })
  .transform((value) => (value ? Number(value) : undefined));
