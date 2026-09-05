import { z } from 'zod';

export const userStatusOptions = ['INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

export const userStatusLabels: Record<(typeof userStatusOptions)[number], string> = {
  INVITED: 'Invité (en attente d’activation)',
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  SUSPENDED: 'Suspendu',
};

/** Statuts qu'un administrateur peut choisir explicitement à l'édition —
 * INVITED est un état de transition automatique (émis par la création,
 * jamais ré-assigné manuellement), pas une option du formulaire. */
export const editableUserStatusOptions = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

export const createUserSchema = z.object({
  email: z.string().min(1, 'Email requis.').email('Email invalide.'),
  name: z.string().min(1, 'Nom requis.'),
  roleIds: z.array(z.string()).min(1, 'Sélectionnez au moins un rôle.'),
});
export type CreateUserFormInput = z.input<typeof createUserSchema>;
export type CreateUserFormValues = z.output<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Nom requis.'),
  status: z.enum(userStatusOptions),
  roleIds: z.array(z.string()).min(1, 'Sélectionnez au moins un rôle.'),
});
export type UpdateUserFormInput = z.input<typeof updateUserSchema>;
export type UpdateUserFormValues = z.output<typeof updateUserSchema>;
